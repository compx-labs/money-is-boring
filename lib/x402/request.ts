import type { KeyStoreAPI } from '@algorandfoundation/react-native-keystore';
import { signX402Payment, x402AmountMicro } from '@/lib/x402/pay';

export type PaidResponse<T> = {
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
 * HTTPS fetch that pays x402 from this wallet when the remote returns 402.
 * No API key. Remotes do not sign or submit.
 */
export async function paidRequest<T>(input: {
  store: Pick<KeyStoreAPI, 'sign'>;
  keyId: string;
  address: string;
  url: string;
  method?: string;
  body?: unknown;
}): Promise<PaidResponse<T>> {
  const method = input.method ?? (input.body === undefined ? 'GET' : 'POST');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (input.body !== undefined) headers['Content-Type'] = 'application/json';
  const body = input.body !== undefined ? JSON.stringify(input.body) : undefined;

  const first = await fetch(input.url, { method, headers, body });
  if (first.status === 200) {
    return { json: (await readJson(first)) as T, paidMicro: 0n };
  }

  const required = paymentRequiredHeader(first);
  if (first.status !== 402 || !required) {
    fail(first.status, await readJson(first), 'Request failed');
  }

  const paidMicro = x402AmountMicro(required);
  const paymentSignature = await signX402Payment(input.store, input.keyId, input.address, required);
  const retry = await fetch(input.url, {
    method,
    headers: { ...headers, 'PAYMENT-SIGNATURE': paymentSignature },
    body,
  });
  if (retry.status !== 200) fail(retry.status, await readJson(retry), 'Payment failed');
  return { json: (await readJson(retry)) as T, paidMicro };
}
