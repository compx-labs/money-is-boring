import { sha256 } from '@noble/hashes/sha2.js';
import { CanonicalWriter } from '@/lib/zerosignal/canonical';
import { b64Decode, verifyEd25519 } from '@/lib/zerosignal/bytes';

const TICKET_TAG = 'zs-ticket-v2\0';
const RECEIPT_TAG = 'zs-receipt-v2\0';
const RESERVE_TAG = 'zs-reserve-v1\0';
const EPHEMERAL_TAG = 'zs-ephemeral-v1\0';
const MAX_EPHEMERAL_LIFETIME_SEC = 40 * 60;
const EPHEMERAL_SKEW_SEC = 60;

export type Ticket = {
  ticket_id: string;
  operator_id: number;
  node_id: number;
  input_count: number;
  max_output_count: number;
  input_rate: number;
  output_rate: number;
  max_price: number;
  min_price: number;
  expires_at: number;
  model: string;
  stream: boolean;
  commit_k: string;
  input_usage_type: number;
  output_usage_type: number;
  cache_read_rate: number;
  sig: string;
};

export type UsageReceipt = {
  ticket_id: string;
  actual_input_count: number;
  actual_output_count: number;
  amount_charged: number;
  ttft_ms: number;
  decode_ms: number;
  body_hash: string;
  input_usage_type: number;
  output_usage_type: number;
  aux_output_usage_type: number;
  aux_output_count: number;
  cached_input_count: number;
  sig: string;
};

export type ReserveRequest = {
  model: string;
  input_count: number;
  max_output_count: number;
  stream: boolean;
  proxy_recipient: string;
  payer_addr: string;
  payer_issued_at: number;
  payer_sig?: string;
};

export type EphemeralAdvertisement = {
  ephemeral_age_pubkey: string;
  ephemeral_expiry: number;
  ephemeral_issued_at: number;
  ephemeral_sig: string;
};

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

export function ticketCanonicalBytes(t: Ticket): Uint8Array {
  return new CanonicalWriter()
    .str(TICKET_TAG)
    .lenStr(t.ticket_id)
    .u64(t.operator_id)
    .u64(t.node_id)
    .u64(t.input_count)
    .u64(t.max_output_count)
    .u64(t.input_rate)
    .u64(t.output_rate)
    .u64(t.max_price)
    .u64(t.min_price)
    .i64(t.expires_at)
    .lenStr(t.model)
    .bool(t.stream)
    .lenStr(t.commit_k)
    .u8(t.input_usage_type)
    .u8(t.output_usage_type)
    .u64(t.cache_read_rate)
    .finish();
}

export function receiptCanonicalBytes(r: UsageReceipt): Uint8Array {
  return new CanonicalWriter()
    .str(RECEIPT_TAG)
    .lenStr(r.ticket_id)
    .u64(r.actual_input_count)
    .u64(r.actual_output_count)
    .u64(r.amount_charged)
    .u64(r.ttft_ms)
    .u64(r.decode_ms)
    .lenStr(r.body_hash)
    .u8(r.input_usage_type)
    .u8(r.output_usage_type)
    .u8(r.aux_output_usage_type)
    .u64(r.aux_output_count)
    .u64(r.cached_input_count)
    .finish();
}

export function reserveCanonicalBytes(
  operatorId: number,
  nodeId: number,
  r: ReserveRequest,
): Uint8Array {
  return new CanonicalWriter()
    .str(RESERVE_TAG)
    .lenStr(r.payer_addr)
    .u64(operatorId)
    .u64(nodeId)
    .lenStr(r.model)
    .u64(r.input_count)
    .u64(r.max_output_count)
    .bool(r.stream)
    .lenStr(r.proxy_recipient)
    .i64(r.payer_issued_at)
    .finish();
}

export function ephemeralCanonicalBytes(
  operatorId: number,
  nodeId: number,
  a: EphemeralAdvertisement,
): Uint8Array {
  return new CanonicalWriter()
    .str(EPHEMERAL_TAG)
    .u64(operatorId)
    .u64(nodeId)
    .lenStr(a.ephemeral_age_pubkey)
    .i64(a.ephemeral_expiry)
    .i64(a.ephemeral_issued_at)
    .finish();
}

function verifyDigest(sigB64: string, digest: Uint8Array, pub: Uint8Array, label: string): void {
  if (pub.length !== 32) throw new Error(`${label}: public key length ${pub.length}`);
  const sig = b64Decode(sigB64);
  if (sig.length !== 64) throw new Error(`${label}: signature length ${sig.length}`);
  if (!verifyEd25519(sig, digest, pub)) throw new Error(`${label} signature failed`);
}

export function parseTicket(raw: unknown): Ticket {
  if (!raw || typeof raw !== 'object') throw new Error('ZeroSignal ticket missing');
  const t = raw as Record<string, unknown>;
  const ticket: Ticket = {
    ticket_id: str(t.ticket_id),
    operator_id: num(t.operator_id),
    node_id: num(t.node_id),
    input_count: num(t.input_count),
    max_output_count: num(t.max_output_count),
    input_rate: num(t.input_rate),
    output_rate: num(t.output_rate),
    max_price: num(t.max_price),
    min_price: num(t.min_price),
    expires_at: num(t.expires_at),
    model: str(t.model),
    stream: Boolean(t.stream),
    commit_k: str(t.commit_k),
    input_usage_type: num(t.input_usage_type),
    output_usage_type: num(t.output_usage_type),
    cache_read_rate: num(t.cache_read_rate),
    sig: str(t.sig),
  };
  if (!ticket.ticket_id || !ticket.sig || !ticket.model) {
    throw new Error('ZeroSignal ticket malformed');
  }
  if (ticket.min_price > ticket.max_price) {
    throw new Error('ZeroSignal ticket min_price exceeds max_price');
  }
  return ticket;
}

export function parseReceipt(raw: unknown): UsageReceipt {
  if (!raw || typeof raw !== 'object') throw new Error('ZeroSignal receipt missing');
  const r = raw as Record<string, unknown>;
  const receipt: UsageReceipt = {
    ticket_id: str(r.ticket_id),
    actual_input_count: num(r.actual_input_count),
    actual_output_count: num(r.actual_output_count),
    amount_charged: num(r.amount_charged),
    ttft_ms: num(r.ttft_ms),
    decode_ms: num(r.decode_ms),
    body_hash: str(r.body_hash),
    input_usage_type: num(r.input_usage_type),
    output_usage_type: num(r.output_usage_type),
    aux_output_usage_type: num(r.aux_output_usage_type),
    aux_output_count: num(r.aux_output_count),
    cached_input_count: num(r.cached_input_count),
    sig: str(r.sig),
  };
  if (!receipt.ticket_id || !receipt.sig || receipt.body_hash.length !== 64) {
    throw new Error('ZeroSignal receipt malformed');
  }
  return receipt;
}

export function verifyTicket(t: Ticket, pub: Uint8Array): void {
  verifyDigest(t.sig, sha256(ticketCanonicalBytes(t)), pub, 'ticket');
}

export function verifyReceipt(r: UsageReceipt, pub: Uint8Array): void {
  verifyDigest(r.sig, sha256(receiptCanonicalBytes(r)), pub, 'receipt');
}

export function verifyEphemeral(
  operatorId: number,
  nodeId: number,
  a: EphemeralAdvertisement,
  pub: Uint8Array,
  nowSec = Math.floor(Date.now() / 1000),
): void {
  verifyDigest(
    a.ephemeral_sig,
    sha256(ephemeralCanonicalBytes(operatorId, nodeId, a)),
    pub,
    'ephemeral',
  );
  if (a.ephemeral_issued_at > nowSec + EPHEMERAL_SKEW_SEC) {
    throw new Error('ZeroSignal ephemeral key issued in the future');
  }
  const lifetime = a.ephemeral_expiry - a.ephemeral_issued_at;
  if (lifetime < 0 || lifetime > MAX_EPHEMERAL_LIFETIME_SEC) {
    throw new Error('ZeroSignal ephemeral key lifetime is too long');
  }
  if (nowSec > a.ephemeral_expiry + EPHEMERAL_SKEW_SEC) {
    throw new Error('ZeroSignal ephemeral key expired');
  }
}

export function verifyCommitK(ticket: Ticket, responseKey: Uint8Array): void {
  if (responseKey.length !== 32) throw new Error('K_response must be 32 bytes');
  const committed = b64Decode(ticket.commit_k);
  if (committed.length !== 32) throw new Error('commit_k must be 32 bytes');
  const got = sha256(responseKey);
  for (let i = 0; i < 32; i += 1) {
    if (got[i] !== committed[i]) throw new Error('commit_k does not match K_response');
  }
}

export function receiptSigDigest(r: UsageReceipt): Uint8Array {
  return sha256(receiptCanonicalBytes(r));
}
