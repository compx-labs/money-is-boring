import { chacha20poly1305 } from '@noble/ciphers/chacha.js';

const MAGIC = new TextEncoder().encode('mibn1');
const NONCE_SIZE = 12;
const TAG_SIZE = 16;
const KEY_SIZE = 32;

function concat(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const part of parts) {
    out.set(part, off);
    off += part.length;
  }
  return out;
}

export function randomNotebookKey(): Uint8Array {
  const key = new Uint8Array(KEY_SIZE);
  crypto.getRandomValues(key);
  return key;
}

export function keyToHex(key: Uint8Array): string {
  return Buffer.from(key).toString('hex');
}

export function keyFromHex(hex: string): Uint8Array {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length !== KEY_SIZE * 2) {
    throw new Error('notebook key malformed');
  }
  return Uint8Array.from(Buffer.from(hex, 'hex'));
}

/** Seal a sqlite serialize() blob. Key stays in the biometric keychain. */
export function sealNotebookBlob(key: Uint8Array, plain: Uint8Array): Uint8Array {
  if (key.length !== KEY_SIZE) throw new Error('notebook key length');
  const nonce = new Uint8Array(NONCE_SIZE);
  crypto.getRandomValues(nonce);
  const ct = chacha20poly1305(key, nonce).encrypt(plain);
  return concat([MAGIC, nonce, ct]);
}

export function openNotebookBlob(key: Uint8Array, blob: Uint8Array): Uint8Array {
  if (key.length !== KEY_SIZE) throw new Error('notebook key length');
  if (blob.length < MAGIC.length + NONCE_SIZE + TAG_SIZE) {
    throw new Error('notebook blob truncated');
  }
  for (let i = 0; i < MAGIC.length; i += 1) {
    if (blob[i] !== MAGIC[i]) throw new Error('notebook blob magic');
  }
  const nonce = blob.subarray(MAGIC.length, MAGIC.length + NONCE_SIZE);
  const ct = blob.subarray(MAGIC.length + NONCE_SIZE);
  return chacha20poly1305(key, nonce).decrypt(ct);
}
