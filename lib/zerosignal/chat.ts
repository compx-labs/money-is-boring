import type { KeyStoreAPI } from '@algorandfoundation/react-native-keystore';
import { sha256 } from '@noble/hashes/sha2.js';
import { b64Encode } from '@/lib/zerosignal/bytes';
import type { ZsNode } from '@/lib/zerosignal/discover';
import { composeOpen, ensureMbrDeposit, isEscrowOptedIn, isMbrPoolGuard, submitPresignedSettleGroup } from '@/lib/zerosignal/escrow';
import {
  parseTicket,
  parseReceipt,
  reserveCanonicalBytes,
  verifyCommitK,
  verifyReceipt,
  verifyTicket,
  type ReserveRequest,
  type Ticket,
  type UsageReceipt,
} from '@/lib/zerosignal/ticket';
import {
  ENCRYPTED_CONTENT_TYPE,
  SEALED_RESERVE_CONTENT_TYPE,
  SEALED_RESERVE_RESPONSE_CONTENT_TYPE,
  computeAdmissionTag,
  decryptSSEDataValue,
  inputTokenBound,
  newAgeIdentity,
  openReserveResponse,
  openSealedHeader,
  parseSseBlock,
  parseSseStream,
  reserveInputCount,
  sealReserveRequest,
  unwrapResponseKey,
  wrapRequest,
  type AgeIdentity,
  type SseEvent,
} from '@/lib/zerosignal/wire';

export const MAX_OUTPUT = 2048;
const MAX_PRICE_MICRO = 100_000;
const RESERVE_MIN_TTL_SEC = 15;

export type ChatTurn = { role: 'user' | 'assistant'; text: string };
export type FunctionCall = { call_id: string; name: string; arguments: string };
export type StreamAcc = {
  text: string;
  contentFrames: Uint8Array[];
  frameIndex: number;
  settleGroupB64: string | null;
  receipt: UsageReceipt | null;
  functionCalls: Map<string, FunctionCall>;
};

function openaiError(json: unknown, fallback: string, status: number): never {
  const err = json as { error?: { message?: string; code?: string } | string; message?: string } | null;
  const message =
    (typeof err?.error === 'string' ? err.error : err?.error?.message) || err?.message || fallback;
  throw new Error(`${message} (${status})`);
}

function stripSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

async function signReserve(
  store: Pick<KeyStoreAPI, 'sign'>,
  keyId: string,
  operatorId: number,
  nodeId: number,
  req: ReserveRequest,
): Promise<void> {
  const digest = sha256(reserveCanonicalBytes(operatorId, nodeId, req));
  const sig = await store.sign(keyId, digest);
  req.payer_sig = b64Encode(sig);
}

function parseNodeTime(message: string): number | null {
  const m = message.match(/node_time=(\d+)/);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function reserveTicket(args: {
  node: ZsNode;
  store: Pick<KeyStoreAPI, 'sign'>;
  keyId: string;
  address: string;
  body: Uint8Array;
  identity: AgeIdentity;
  issuedAt?: number;
}): Promise<{ ticket: Ticket; responseKey: Uint8Array; presignedOpenTxn: string }> {
  const inputCount = reserveInputCount(inputTokenBound(args.body));
  const payload: ReserveRequest = {
    model: args.node.model,
    input_count: inputCount,
    max_output_count: MAX_OUTPUT,
    stream: true,
    proxy_recipient: args.identity.recipient,
    payer_addr: args.address,
    payer_issued_at: args.issuedAt ?? Math.floor(Date.now() / 1000),
  };
  await signReserve(args.store, args.keyId, args.node.operatorId, args.node.nodeId, payload);
  const sealed = await sealReserveRequest(
    new TextEncoder().encode(JSON.stringify(payload)),
    args.node.ageRecipient,
  );

  const res = await fetch(`${stripSlash(args.node.baseUrl)}/v1/zs/reserve`, {
    method: 'POST',
    headers: {
      'Content-Type': SEALED_RESERVE_CONTENT_TYPE,
      Accept: `${SEALED_RESERVE_RESPONSE_CONTENT_TYPE}, application/json`,
    },
    body: new TextDecoder().decode(sealed),
  });

  if (res.status !== 200) {
    const json = await res.json().catch(() => null);
    const message =
      typeof json === 'object' && json
        ? String(
            (json as { error?: { message?: string } }).error?.message ??
              (json as { message?: string }).message ??
              `reserve failed`,
          )
        : `reserve failed`;
    if (res.status === 401 && message.includes('invalid_payer_sig') && args.issuedAt == null) {
      const nodeTime = parseNodeTime(message);
      if (nodeTime != null) {
        return reserveTicket({ ...args, issuedAt: nodeTime });
      }
    }
    openaiError(json, message, res.status);
  }

  const opened = await openReserveResponse(new Uint8Array(await res.arrayBuffer()), args.identity);
  const root = JSON.parse(new TextDecoder().decode(opened)) as Record<string, unknown>;
  const ticket = parseTicket(root.ticket);
  if (ticket.operator_id !== args.node.operatorId || ticket.node_id !== args.node.nodeId) {
    throw new Error('ZeroSignal ticket is for a different node');
  }
  if (ticket.model !== args.node.model) throw new Error('ZeroSignal ticket model mismatch');
  if (ticket.max_output_count !== MAX_OUTPUT) throw new Error('ZeroSignal ticket output cap mismatch');
  if (ticket.stream !== true) throw new Error('ZeroSignal ticket is not streaming');
  if (ticket.expires_at - Math.floor(Date.now() / 1000) < RESERVE_MIN_TTL_SEC) {
    throw new Error('ZeroSignal ticket is expired or too close to expiry');
  }
  if (ticket.max_price > MAX_PRICE_MICRO) {
    throw new Error(`ZeroSignal quote ${ticket.max_price} microUSDC exceeds the 0.10 USDC cap`);
  }
  verifyTicket(ticket, args.node.signingPubKey);
  const wrapped = root.wrapped_response_key;
  if (typeof wrapped !== 'string' || !wrapped) throw new Error('reserve missing wrapped_response_key');
  const responseKey = await unwrapResponseKey(wrapped, args.identity);
  verifyCommitK(ticket, responseKey);
  const presignedOpenTxn = typeof root.presigned_open_txn === 'string' ? root.presigned_open_txn : '';
  if (!presignedOpenTxn) throw new Error('reserve missing presigned_open_txn');
  return { ticket, responseKey, presignedOpenTxn };
}

function collectDelta(obj: unknown, soFar: string): string {
  if (!obj || typeof obj !== 'object') return soFar;
  const rec = obj as { type?: unknown; delta?: unknown };
  if (rec.type === 'response.output_text.delta' && typeof rec.delta === 'string') {
    return soFar + rec.delta;
  }
  return soFar;
}

function isTerminal(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false;
  const type = (obj as { type?: unknown }).type;
  return type === 'response.completed' || type === 'response.incomplete' || type === 'response.failed';
}

function considerFunctionItem(item: unknown, calls: Map<string, FunctionCall>): void {
  if (!item || typeof item !== 'object') return;
  const it = item as Record<string, unknown>;
  if (it.type !== 'function_call' || typeof it.name !== 'string') return;
  const call_id = String(it.call_id ?? it.id ?? it.name);
  calls.set(call_id, {
    call_id,
    name: it.name,
    arguments: typeof it.arguments === 'string' ? it.arguments : JSON.stringify(it.arguments ?? {}),
  });
}

function ingestFunctionCall(obj: unknown, calls: Map<string, FunctionCall>): void {
  if (!obj || typeof obj !== 'object') return;
  const rec = obj as Record<string, unknown>;
  if (rec.type === 'response.output_item.done' || rec.type === 'response.output_item.added') {
    considerFunctionItem(rec.item, calls);
  }
  if (rec.type === 'response.function_call_arguments.done') {
    const call_id = String(rec.call_id ?? rec.item_id ?? '');
    if (!call_id) return;
    const prev = calls.get(call_id);
    const args = typeof rec.arguments === 'string' ? rec.arguments : prev?.arguments ?? '{}';
    const name = typeof rec.name === 'string' ? rec.name : prev?.name;
    if (name) calls.set(call_id, { call_id, name, arguments: args });
  }
  if (rec.type === 'response.completed' && rec.response && typeof rec.response === 'object') {
    const output = (rec.response as { output?: unknown }).output;
    if (Array.isArray(output)) {
      for (const item of output) considerFunctionItem(item, calls);
    }
  }
}

function handleSse(
  ev: SseEvent,
  acc: StreamAcc,
  args: { responseKey: Uint8Array; txID: string; ticketID: string; onDelta?: (text: string) => void },
): void {
  if (ev.data === '[DONE]') return;
  if (ev.event === 'zs-settle-group') {
    try {
      acc.settleGroupB64 = new TextDecoder().decode(
        openSealedHeader(ev.data, args.responseKey, args.txID, args.ticketID, 'settle-group'),
      );
    } catch {
      acc.settleGroupB64 = null;
    }
    return;
  }
  if (ev.event !== 'zs' && ev.event !== 'zs-receipt') return;
  const plaintext = decryptSSEDataValue(
    ev.data,
    args.responseKey,
    args.txID,
    args.ticketID,
    acc.frameIndex,
  );
  acc.frameIndex += 1;
  if (ev.event === 'zs-receipt') {
    try {
      acc.receipt = parseReceipt(JSON.parse(new TextDecoder().decode(plaintext)));
    } catch {
      acc.receipt = null;
    }
    return;
  }
  acc.contentFrames.push(plaintext);
  try {
    const obj = JSON.parse(new TextDecoder().decode(plaintext));
    ingestFunctionCall(obj, acc.functionCalls);
    const next = collectDelta(obj, acc.text);
    if (next !== acc.text) {
      acc.text = next;
      args.onDelta?.(acc.text);
    }
    if (isTerminal(obj) && (obj as { type?: string }).type === 'response.failed') {
      const err = obj as { response?: { error?: { message?: string } } };
      if (err.response?.error?.message) throw new Error(err.response.error.message);
    }
  } catch {
    // Non-JSON content frames are still hashed.
  }
}

async function readSse(
  res: Response,
  args: { responseKey: Uint8Array; txID: string; ticketID: string; onDelta?: (text: string) => void },
): Promise<StreamAcc> {
  const acc: StreamAcc = {
    text: '',
    contentFrames: [],
    frameIndex: 0,
    settleGroupB64: null,
    receipt: null,
    functionCalls: new Map(),
  };
  const reader = res.body?.getReader?.();
  if (!reader) {
    for (const ev of parseSseStream(await res.text())) handleSse(ev, acc, args);
    return acc;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = buffer.replace(/\r\n/g, '\n');
    while (true) {
      const idx = buffer.indexOf('\n\n');
      if (idx === -1) break;
      const ev = parseSseBlock(buffer.slice(0, idx));
      buffer = buffer.slice(idx + 2);
      if (ev) handleSse(ev, acc, args);
    }
  }
  const tail = parseSseBlock(buffer);
  if (tail) handleSse(tail, acc, args);
  return acc;
}

function bodyHashHexLocal(frames: Uint8Array[]): string {
  const h = sha256.create();
  for (const f of frames) h.update(f);
  return Buffer.from(h.digest()).toString('hex');
}

/**
 * One sealed pay-per-call inference round. Tickets, age, receipts, and settle
 * stay here. Pi owns the tool loop — see lib/agent/turn.ts.
 */
export async function sealedRound(input: {
  node: ZsNode;
  store: Pick<KeyStoreAPI, 'sign'>;
  keyId: string;
  address: string;
  body: Uint8Array;
  onStatus?: (step: string) => void;
  onDelta?: (text: string) => void;
}): Promise<{ acc: StreamAcc; chargedMicro: number }> {
  const { node, store, keyId, address, body } = input;
  const identity = await newAgeIdentity();

  input.onStatus?.('reserving');
  const reserved = await reserveTicket({
    node,
    store,
    keyId,
    address,
    body,
    identity,
  });

  input.onStatus?.('opening escrow');
  if (!(await isEscrowOptedIn(address))) {
    input.onStatus?.('funding ticket pool');
    await ensureMbrDeposit(store, keyId, address);
  }
  let txids: string[];
  try {
    txids = (
      await composeOpen(store, keyId, {
        ticket: reserved.ticket,
        payerAddress: address,
        signingAddr: node.signingAddr,
        presignedOpenTxn: reserved.presignedOpenTxn,
      })
    ).txids;
  } catch (openErr) {
    if (!isMbrPoolGuard(openErr)) throw openErr;
    input.onStatus?.('funding ticket pool');
    await ensureMbrDeposit(store, keyId, address);
    txids = (
      await composeOpen(store, keyId, {
        ticket: reserved.ticket,
        payerAddress: address,
        signingAddr: node.signingAddr,
        presignedOpenTxn: reserved.presignedOpenTxn,
      })
    ).txids;
  }

  const algorandTxId = txids[1];
  const admissionTag = computeAdmissionTag(
    reserved.responseKey,
    reserved.ticket.ticket_id,
    algorandTxId,
    body,
  );
  const envelope = await wrapRequest({
    body,
    txID: algorandTxId,
    ticketID: reserved.ticket.ticket_id,
    admissionTag,
    nodeRecipient: node.ageRecipient,
    ephemeral: identity,
  });

  input.onStatus?.('thinking');
  const infer = await fetch(`${stripSlash(node.baseUrl)}/v1/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': ENCRYPTED_CONTENT_TYPE,
      Accept: 'text/event-stream',
    },
    body: new TextDecoder().decode(envelope),
  });
  if (!infer.ok) {
    const json = await infer.json().catch(() => null);
    openaiError(json, 'inference failed', infer.status);
  }

  const acc = await readSse(infer, {
    responseKey: reserved.responseKey,
    txID: algorandTxId,
    ticketID: reserved.ticket.ticket_id,
    onDelta: input.onDelta,
  });

  let chargedMicro = 0;
  if (acc.receipt) {
    try {
      const hex = bodyHashHexLocal(acc.contentFrames);
      if (hex !== acc.receipt.body_hash.toLowerCase()) {
        throw new Error('receipt body_hash does not match the stream');
      }
      verifyReceipt(acc.receipt, node.signingPubKey);
      if (acc.receipt.amount_charged > reserved.ticket.max_price) {
        throw new Error('receipt amount exceeds ticket max_price');
      }
      chargedMicro = acc.receipt.amount_charged;
      if (acc.settleGroupB64) {
        await submitPresignedSettleGroup(store, keyId, {
          settleGroupB64: acc.settleGroupB64,
          payerAddress: address,
        });
      }
    } catch {
      // Operator force-finalizes after grace if the payer ack is silent.
    }
  }

  reserved.responseKey.fill(0);
  return { acc, chargedMicro };
}
