import type { KeyStoreAPI } from '@algorandfoundation/react-native-keystore';
import { CANIX_URL } from '@/lib/theme';
import { signX402Payment, x402AmountMicro } from '@/lib/canix/x402';

export type CanixResponse<T> = {
  json: T;
  paidMicro: bigint;
};

function fail(status: number, json: unknown, fallback: string): never {
  const err = json as { error?: { message?: string } | string; message?: string } | null;
  const message =
    (typeof err?.error === 'string' ? err.error : err?.error?.message) || err?.message || fallback;
  throw new Error(`${message} (${status})`);
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function paymentRequiredHeader(res: Response): string | null {
  return res.headers.get('PAYMENT-REQUIRED') ?? res.headers.get('payment-required');
}

/**
 * Call Canix. Free routes return immediately. Paid agent routes take USDC
 * from the wallet via x402 — no API key, no invoices.
 */
export async function canixRequest<T>(input: {
  store: Pick<KeyStoreAPI, 'sign'>;
  keyId: string;
  address: string;
  path: string;
  method?: string;
  body?: unknown;
}): Promise<CanixResponse<T>> {
  const url = `${CANIX_URL}${input.path}`;
  const method = input.method ?? (input.body === undefined ? 'GET' : 'POST');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (input.body !== undefined) headers['Content-Type'] = 'application/json';
  const body = input.body !== undefined ? JSON.stringify(input.body) : undefined;

  const first = await fetch(url, { method, headers, body });
  if (first.status === 200) {
    return { json: (await readJson(first)) as T, paidMicro: 0n };
  }

  const required = paymentRequiredHeader(first);
  if (first.status !== 402 || !required) {
    fail(first.status, await readJson(first), 'Canix request failed');
  }

  const paidMicro = x402AmountMicro(required);
  const paymentSignature = await signX402Payment(input.store, input.keyId, input.address, required);
  const retry = await fetch(url, {
    method,
    headers: { ...headers, 'PAYMENT-SIGNATURE': paymentSignature },
    body,
  });
  if (retry.status !== 200) fail(retry.status, await readJson(retry), 'Canix payment failed');
  return { json: (await readJson(retry)) as T, paidMicro };
}
