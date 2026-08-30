import { CANIX_URL, HAY_SLIPPAGE_PCT } from '@/lib/theme';
import type { KeyStoreAPI } from '@algorandfoundation/react-native-keystore';
import { signX402Payment } from '@/lib/canix/x402';
import type { WalletlessTxn } from '@/lib/algorand/submit';

export type HayQuote = {
  address: string;
  fromAssetId: string;
  toAssetId: string;
  amount: string;
  type: 'fixed-input' | 'fixed-output';
  quotedAmount: string;
  createdAt: string;
  expiresAt: string;
  requiredAppOptIns: string[];
  txnPayload: { iv: string; data: string } | null;
  route: unknown[];
  quotes: unknown[];
  protocolFees: Record<string, number>;
  usdIn?: number;
  usdOut?: number;
  userPriceImpact?: number;
};

type Envelope<T> = { data: T };

async function canixJson<T>(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; json: T | null; paymentRequired: string | null }> {
  const res = await fetch(`${CANIX_URL}${path}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const paymentRequired = res.headers.get('PAYMENT-REQUIRED') ?? res.headers.get('payment-required');
  const text = await res.text();
  let json: T | null = null;
  if (text) {
    try {
      json = JSON.parse(text) as T;
    } catch {
      json = null;
    }
  }
  return { status: res.status, json, paymentRequired };
}

function fail(status: number, json: unknown, fallback: string): never {
  const err = json as { error?: { message?: string } | string; message?: string } | null;
  const message =
    (typeof err?.error === 'string' ? err.error : err?.error?.message) || err?.message || fallback;
  throw new Error(`${message} (${status})`);
}

export async function quoteHaySwap(input: {
  address: string;
  fromAssetId: number;
  toAssetId: number;
  amount: string;
}): Promise<HayQuote> {
  const { status, json } = await canixJson<Envelope<HayQuote>>('/swaps/quote', {
    ...input,
    type: 'fixed-input',
  });
  if (status !== 200 || !json?.data) fail(status, json, 'quote failed');
  return json.data;
}

export async function hayOptIns(
  address: string,
  quote: HayQuote,
): Promise<{ required: boolean; transactions: WalletlessTxn[]; userSignIndexes: number[] }> {
  const { status, json } = await canixJson<
    Envelope<{
      required: boolean;
      transactions: WalletlessTxn[];
      userSignIndexes: number[];
    }>
  >('/swaps/optin', { address, quote });
  if (status !== 200 || !json?.data) fail(status, json, 'opt-in failed');
  return json.data;
}

export async function haySwapGroup(
  store: Pick<KeyStoreAPI, 'sign'>,
  keyId: string,
  address: string,
  quote: HayQuote,
  slippage = HAY_SLIPPAGE_PCT,
): Promise<{ transactions: WalletlessTxn[]; userSignIndexes: number[] }> {
  const body = { address, quote, slippage };
  const first = await canixJson<Envelope<{ transactions: WalletlessTxn[]; userSignIndexes: number[] }>>(
    '/swaps/transactions',
    body,
  );
  if (first.status === 200 && first.json?.data) return first.json.data;
  if (first.status !== 402 || !first.paymentRequired) fail(first.status, first.json, 'swap group failed');

  const paymentSignature = await signX402Payment(store, keyId, address, first.paymentRequired);
  const retry = await canixJson<Envelope<{ transactions: WalletlessTxn[]; userSignIndexes: number[] }>>(
    '/swaps/transactions',
    body,
    { 'PAYMENT-SIGNATURE': paymentSignature },
  );
  if (retry.status !== 200 || !retry.json?.data) fail(retry.status, retry.json, 'swap group failed');
  return retry.json.data;
}
