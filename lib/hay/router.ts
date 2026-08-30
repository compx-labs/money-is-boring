import { ALGOD_URL, HAY_API_KEY, HAY_FEE_BPS, HAY_SLIPPAGE_PCT, HAY_URL } from '@/lib/theme';

export type HayTxnPayload = { iv: string; data: string };

export type HayQuote = {
  address: string;
  fromASAID: number;
  toASAID: number;
  amount: string;
  type: 'fixed-input' | 'fixed-output';
  quotedAmount: string;
  txnPayload: HayTxnPayload | null;
  requiredAppOptIns: number[];
  userPriceImpact?: number;
  usdIn?: number;
  usdOut?: number;
};

export type HayTxn = {
  data: string;
  group?: string;
  logicSigBlob?: unknown;
  signature?: { type: string; value: unknown } | false;
};

type QuoteResponse = {
  quote?: string | number;
  fromASAID?: number;
  toASAID?: number;
  type?: string;
  txnPayload?: HayTxnPayload | null;
  requiredAppOptIns?: number[];
  userPriceImpact?: number;
  usdIn?: number;
  usdOut?: number;
  message?: string;
  error?: string | { message?: string };
};

type TxnsResponse = {
  txns?: HayTxn[];
  message?: string;
  error?: string | { message?: string };
};

function fail(status: number, json: unknown, fallback: string): never {
  const err = json as { error?: { message?: string } | string; message?: string } | null;
  const message =
    (typeof err?.error === 'string' ? err.error : err?.error?.message) || err?.message || fallback;
  throw new Error(`${message} (${status})`);
}

async function hayJson<T>(url: string, init?: RequestInit): Promise<{ status: number; json: T | null }> {
  const res = await fetch(url, init);
  const text = await res.text();
  let json: T | null = null;
  if (text) {
    try {
      json = JSON.parse(text) as T;
    } catch {
      json = null;
    }
  }
  return { status: res.status, json };
}

async function accountAssetsAndApps(address: string): Promise<{
  assets: number[];
  apps: number[];
}> {
  const res = await fetch(`${ALGOD_URL}/v2/accounts/${address}`, {
    headers: { Accept: 'application/json' },
  });
  if (res.status === 404) return { assets: [], apps: [] };
  if (!res.ok) throw new Error(`algod ${res.status}`);
  const body = (await res.json()) as {
    assets?: { 'asset-id': number }[];
    'apps-local-state'?: { id: number }[];
  };
  return {
    assets: (body.assets ?? []).map((a) => a['asset-id']),
    apps: (body['apps-local-state'] ?? []).map((a) => a.id),
  };
}

export async function needsAssetOptIn(address: string, assetId: number): Promise<boolean> {
  if (assetId === 0) return false;
  const { assets } = await accountAssetsAndApps(address);
  return !assets.includes(assetId);
}

export async function neededAppOptIns(address: string, appIds: number[]): Promise<number[]> {
  if (appIds.length === 0) return [];
  const { apps } = await accountAssetsAndApps(address);
  const opted = new Set(apps);
  return appIds.filter((id) => !opted.has(id));
}

export async function quoteHaySwap(input: {
  address: string;
  fromAssetId: number;
  toAssetId: number;
  amount: string;
}): Promise<HayQuote> {
  const optIn = await needsAssetOptIn(input.address, input.toAssetId);
  const url = new URL(`${HAY_URL}/api/fetchQuote`);
  url.searchParams.set('apiKey', HAY_API_KEY);
  url.searchParams.set('algodUri', ALGOD_URL);
  url.searchParams.set('algodToken', '');
  url.searchParams.set('algodPort', '443');
  url.searchParams.set('feeBps', String(HAY_FEE_BPS));
  url.searchParams.set('fromASAID', String(input.fromAssetId));
  url.searchParams.set('toASAID', String(input.toAssetId));
  url.searchParams.set('amount', input.amount);
  url.searchParams.set('type', 'fixed-input');
  url.searchParams.set('disabledProtocols', 'Humble,Tinyman');
  url.searchParams.set('maxGroupSize', '16');
  url.searchParams.set('maxDepth', '4');
  url.searchParams.set('optIn', String(optIn));

  const { status, json } = await hayJson<QuoteResponse>(url.toString());
  if (status !== 200 || json == null) fail(status, json, 'quote failed');
  if (json.txnPayload == null || json.quote === undefined || json.quote === '') {
    fail(status, json, 'no Hay route');
  }

  return {
    address: input.address,
    fromASAID: json.fromASAID ?? input.fromAssetId,
    toASAID: json.toASAID ?? input.toAssetId,
    amount: input.amount,
    type: json.type === 'fixed-output' ? 'fixed-output' : 'fixed-input',
    quotedAmount: String(json.quote),
    txnPayload: json.txnPayload,
    requiredAppOptIns: json.requiredAppOptIns ?? [],
    userPriceImpact: json.userPriceImpact,
    usdIn: json.usdIn,
    usdOut: json.usdOut,
  };
}

export async function fetchHaySwapTxns(
  address: string,
  quote: HayQuote,
  slippage = HAY_SLIPPAGE_PCT,
): Promise<HayTxn[]> {
  if (!quote.txnPayload) throw new Error('Quote has no Hay payload');
  const { status, json } = await hayJson<TxnsResponse>(`${HAY_URL}/api/fetchExecuteSwapTxns`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address,
      txnPayloadJSON: quote.txnPayload,
      slippage,
      apiKey: HAY_API_KEY,
    }),
  });
  if (status !== 200 || !json?.txns?.length) fail(status, json, 'swap group failed');
  return json.txns;
}
