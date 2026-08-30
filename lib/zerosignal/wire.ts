import { Encrypter, Decrypter, generateX25519Identity, identityToRecipient } from 'age-encryption';
import { chacha20poly1305 } from '@noble/ciphers/chacha.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { b64Decode, b64Encode, concatBytes, utf8 } from '@/lib/zerosignal/bytes';

const NONCE_SIZE = 12;
const TAG_SIZE = 16;
const INNER_MAGIC = utf8('zsrq');
const ADMISSION_DOMAIN = utf8('zs-admission-v1\0');
const NUL = Uint8Array.of(0);

export const SEALED_RESERVE_CONTENT_TYPE = 'application/vnd.zs-reserve+json';
export const SEALED_RESERVE_RESPONSE_CONTENT_TYPE = 'application/vnd.zs-reserve-response+json';
export const ENCRYPTED_CONTENT_TYPE = 'application/vnd.zs+json';

export type AgeIdentity = { secret: string; recipient: string };

export async function newAgeIdentity(): Promise<AgeIdentity> {
  const secret = await generateX25519Identity();
  const recipient = await identityToRecipient(secret);
  return { secret, recipient };
}

export async function ageEncrypt(recipient: string, plaintext: Uint8Array): Promise<Uint8Array> {
  const enc = new Encrypter();
  enc.addRecipient(recipient);
  return enc.encrypt(plaintext);
}

export async function ageDecrypt(secret: string, ciphertext: Uint8Array): Promise<Uint8Array> {
  const dec = new Decrypter();
  dec.addIdentity(secret);
  return dec.decrypt(ciphertext);
}

function u32be(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n >>> 0, false);
  return b;
}

function u64be(n: number | bigint): Uint8Array {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, BigInt(n), false);
  return b;
}

export function encodeInnerRequest(header: Record<string, string>, body: Uint8Array): Uint8Array {
  const headerJSON = utf8(JSON.stringify(header));
  return concatBytes(INNER_MAGIC, Uint8Array.of(1), u32be(headerJSON.length), headerJSON, body);
}

export function buildBodyAAD(txID: string, ticketID: string): Uint8Array {
  return concatBytes(utf8('zs'), NUL, utf8('body'), NUL, utf8(txID), NUL, utf8(ticketID));
}

export function buildFrameAAD(txID: string, ticketID: string, frameIndex: number | bigint): Uint8Array {
  return concatBytes(
    utf8('zs'),
    NUL,
    utf8('frame'),
    NUL,
    utf8(txID),
    NUL,
    utf8(ticketID),
    NUL,
    u64be(frameIndex),
  );
}

export function buildHeaderAAD(txID: string, ticketID: string, name: string): Uint8Array {
  return concatBytes(
    utf8('zs'),
    NUL,
    utf8('hdr'),
    NUL,
    utf8(txID),
    NUL,
    utf8(ticketID),
    NUL,
    utf8(name),
  );
}

export function computeAdmissionTag(
  k: Uint8Array,
  ticketID: string,
  txID: string,
  body: Uint8Array,
): Uint8Array {
  const message = concatBytes(
    ADMISSION_DOMAIN,
    utf8(ticketID),
    NUL,
    utf8(txID),
    NUL,
    sha256(body),
  );
  return hmac(sha256, k, message);
}

export async function wrapRequest(args: {
  body: Uint8Array;
  txID: string;
  ticketID: string;
  admissionTag: Uint8Array;
  nodeRecipient: string;
  ephemeral: AgeIdentity;
}): Promise<Uint8Array> {
  const header: Record<string, string> = {
    reply_to_public_key: args.ephemeral.recipient,
    algorand_tx_id: args.txID,
    ticket_id: args.ticketID,
    admission_tag: b64Encode(args.admissionTag),
  };
  const ciphertext = await ageEncrypt(args.nodeRecipient, encodeInnerRequest(header, args.body));
  return utf8(JSON.stringify({ ciphertext: b64Encode(ciphertext) }));
}

export async function unwrapResponseKey(b64Wrapped: string, identity: AgeIdentity): Promise<Uint8Array> {
  const raw = await ageDecrypt(identity.secret, b64Decode(b64Wrapped));
  if (raw.length !== 32) throw new Error(`unexpected response key length ${raw.length}`);
  return raw;
}

function openAead(key: Uint8Array, nonceCt: Uint8Array, aad: Uint8Array, label: string): Uint8Array {
  if (nonceCt.length < NONCE_SIZE + TAG_SIZE) {
    throw new Error(`${label} too short (${nonceCt.length} bytes)`);
  }
  const nonce = nonceCt.subarray(0, NONCE_SIZE);
  const ct = nonceCt.subarray(NONCE_SIZE);
  try {
    return chacha20poly1305(key, nonce, aad).decrypt(ct);
  } catch {
    throw new Error(`${label} AEAD open failed`);
  }
}

export function decryptSSEDataValue(
  b64: string,
  responseKey: Uint8Array,
  txID: string,
  ticketID: string,
  frameIndex: number | bigint,
): Uint8Array {
  return openAead(responseKey, b64Decode(b64), buildFrameAAD(txID, ticketID, frameIndex), 'sse frame');
}

export function openSealedHeader(
  b64: string,
  responseKey: Uint8Array,
  txID: string,
  ticketID: string,
  name: string,
): Uint8Array {
  return openAead(responseKey, b64Decode(b64), buildHeaderAAD(txID, ticketID, name), `sealed ${name}`);
}

export async function sealReserveRequest(body: Uint8Array, operatorRecipient: string): Promise<Uint8Array> {
  const ciphertext = await ageEncrypt(operatorRecipient, body);
  return utf8(JSON.stringify({ ciphertext: b64Encode(ciphertext) }));
}

export async function openReserveResponse(envelopeJSON: Uint8Array, identity: AgeIdentity): Promise<Uint8Array> {
  let env: { ciphertext?: string };
  try {
    env = JSON.parse(new TextDecoder().decode(envelopeJSON)) as { ciphertext?: string };
  } catch {
    throw new Error('sealed reserve envelope is not JSON');
  }
  if (!env.ciphertext) throw new Error('sealed reserve envelope missing ciphertext');
  return ageDecrypt(identity.secret, b64Decode(env.ciphertext));
}

export function bodyHashFromFrames(frames: Uint8Array[]): Uint8Array {
  const h = sha256.create();
  for (const f of frames) h.update(f);
  return h.digest();
}

export function bodyHashHex(frames: Uint8Array[]): string {
  return Buffer.from(bodyHashFromFrames(frames)).toString('hex');
}

export type SseEvent = { event: string; data: string };

export function parseSseBlock(block: string): SseEvent | null {
  let event = 'message';
  const dataLines: string[] = [];
  for (const rawLine of block.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (!line || line.startsWith(':')) continue;
    const sep = line.indexOf(':');
    const field = sep === -1 ? line : line.slice(0, sep);
    const value = sep === -1 ? '' : line.slice(sep + 1).replace(/^ /, '');
    if (field === 'event') event = value;
    else if (field === 'data') dataLines.push(value);
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join('\n') };
}

export function parseSseStream(text: string): SseEvent[] {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n\n')
    .map(parseSseBlock)
    .filter((e): e is SseEvent => e != null);
}

export function inputTokenBound(body: Uint8Array): number {
  return Math.ceil(body.byteLength / 2) + 32;
}

export function reserveInputCount(bodyBound: number, floor = 256): number {
  return Math.max(floor, Math.max(0, Math.floor(bodyBound)));
}
