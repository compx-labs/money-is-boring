import type { KeyStoreAPI } from '@algorandfoundation/react-native-keystore';
import { sha256 } from '@noble/hashes/sha2.js';
import { fromBaseUnits } from '@/lib/algorand/balances';
import { b64Encode } from '@/lib/zerosignal/bytes';
import type { ZsNode } from '@/lib/zerosignal/discover';
import { composeOpen, ensureMbrDeposit, isEscrowOptedIn, isMbrPoolGuard, submitPresignedSettleGroup } from '@/lib/zerosignal/escrow';
import type { PayListener, PayStep } from '@/lib/zerosignal/pay';
import {
  emptySseFields,
  failedResponseMessage,
  finalizeSseAcc,
  ingestFrame,
  namedFunctionCalls,
  type FunctionCall,
} from '@/lib/zerosignal/sse-tools';
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
export type { FunctionCall };
export type StreamAcc = {
  text: string;
  reasoning: string;
  eventTypes: string[];
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

function throwIfFailedFrame(plaintext: Uint8Array): void {
  const raw = new TextDecoder().decode(plaintext).trim();
  if (!raw.startsWith('{') && !raw.startsWith('[')) return;
  try {
    const fail = failedResponseMessage(JSON.parse(raw));
    if (fail) throw new Error(fail);
  } catch (err) {
    if (err instanceof SyntaxError) return;
    throw err;
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
  const before = acc.text;
  ingestFrame(plaintext, acc);
  if (acc.text !== before) args.onDelta?.(acc.text);
  throwIfFailedFrame(plaintext);
}

async function readSse(
  res: Response,
  args: { responseKey: Uint8Array; txID: string; ticketID: string; onDelta?: (text: string) => void },
): Promise<StreamAcc> {
  const acc: StreamAcc = {
    ...emptySseFields(),
    contentFrames: [],
    frameIndex: 0,
    settleGroupB64: null,
    receipt: null,
  };
  const reader = res.body?.getReader?.();
  if (!reader) {
    for (const ev of parseSseStream(await res.text())) handleSse(ev, acc, args);
    finalizeSseAcc(acc);
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
  finalizeSseAcc(acc);
  if (!acc.text && namedFunctionCalls(acc.functionCalls).length === 0) {
    console.warn('[agent pay] empty inference', acc.eventTypes.slice(0, 24));
  }
  return acc;
}

function bodyHashHexLocal(frames: Uint8Array[]): string {
  const h = sha256.create();
  for (const f of frames) h.update(f);
  return Buffer.from(h.digest()).toString('hex');
}

async function waitToSign(
  input: { onPay?: PayListener; awaitSign?: () => Promise<void> },
  step: PayStep,
  amountLabel?: string,
): Promise<void> {
  input.onPay?.({ type: 'step', step, amountLabel });
  if (step === 'settle') return;
  await input.awaitSign?.();
}

function isSignCancel(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err);
  return raw.toLowerCase().includes('sign cancelled');
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
  onPay?: PayListener;
  awaitSign?: () => Promise<void>;
  onDelta?: (text: string) => void;
}): Promise<{ acc: StreamAcc; chargedMicro: number }> {
  const { node, store, keyId, address, body } = input;
  const identity = await newAgeIdentity();

  await waitToSign(input, 'reserve');
  const reserved = await reserveTicket({
    node,
    store,
    keyId,
    address,
    body,
    identity,
  });
  const lockLabel = fromBaseUnits(String(reserved.ticket.max_price), 6);

  if (!(await isEscrowOptedIn(address))) {
    await waitToSign(input, 'fundPool');
    await ensureMbrDeposit(store, keyId, address);
  }
  let txids: string[];
  try {
    await waitToSign(input, 'openEscrow', lockLabel);
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
    await waitToSign(input, 'fundPool');
    await ensureMbrDeposit(store, keyId, address);
    await waitToSign(input, 'openEscrow', lockLabel);
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

  input.onPay?.({ type: 'step', step: 'think' });
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
  const usable = Boolean(acc.text || namedFunctionCalls(acc.functionCalls).length > 0);
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
        input.onPay?.({ type: 'step', step: 'settle' });
        await submitPresignedSettleGroup(store, keyId, {
          settleGroupB64: acc.settleGroupB64,
          payerAddress: address,
        });
      }
    } catch (err) {
      if (isSignCancel(err) && !usable) throw err;
      input.onPay?.({
        type: 'warning',
        step: 'settle',
        message: 'charge will finish on-chain',
      });
    }
  } else if (usable) {
    input.onPay?.({
      type: 'warning',
      step: 'settle',
      message: 'charge will finish on-chain',
    });
  }

  reserved.responseKey.fill(0);
  return { acc, chargedMicro };
}
