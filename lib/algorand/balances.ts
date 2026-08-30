import { ALGOD_URL, USDC_ASA_ID } from '@/lib/theme';

export const BALANCE_POLL_MS = 10_000;

export type Holding = {
  id: number;
  unit: string;
  amount: number | null;
  decimals: number;
};

export type Balances = {
  holdings: Holding[];
  error?: string;
};

type AlgodAccount = {
  amount?: number | bigint;
  assets?: { 'asset-id': number; amount: number | bigint }[];
};

type AlgodAsset = {
  params?: {
    decimals?: number;
    name?: string;
    'unit-name'?: string;
  };
};

const algoHolding = (amount: number | null): Holding => ({
  id: 0,
  unit: 'ALGO',
  amount,
  decimals: 6,
});

export const emptyBalances = (): Balances => ({
  holdings: [algoHolding(null)],
});

const paramsCache = new Map<number, { unit: string; decimals: number }>([
  [USDC_ASA_ID, { unit: 'USDC', decimals: 6 }],
]);

function toDecimal(amount: number | bigint, decimals: number): number {
  return Number(amount) / 10 ** decimals;
}

async function assetMeta(id: number): Promise<{ unit: string; decimals: number }> {
  const cached = paramsCache.get(id);
  if (cached) return cached;

  try {
    const res = await fetch(`${ALGOD_URL}/v2/assets/${id}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      const fallback = { unit: String(id), decimals: 0 };
      paramsCache.set(id, fallback);
      return fallback;
    }
    const body = (await res.json()) as AlgodAsset;
    const unit = body.params?.['unit-name'] || body.params?.name || String(id);
    const meta = { unit, decimals: body.params?.decimals ?? 0 };
    paramsCache.set(id, meta);
    return meta;
  } catch {
    return { unit: String(id), decimals: 0 };
  }
}

export async function lookupAsset(id: number): Promise<{ unit: string; decimals: number }> {
  if (id === 0) return { unit: 'ALGO', decimals: 6 };
  return assetMeta(id);
}

/** Display amount → base units as a decimal string Hay expects. */
export function toBaseUnits(display: string, decimals: number): string {
  const trimmed = display.trim();
  if (!trimmed || trimmed === '.') return '0';
  const [wholeRaw, fracRaw = ''] = trimmed.split('.');
  const whole = wholeRaw.replace(/^0+(?=\d)/, '') || '0';
  const frac = (fracRaw + '0'.repeat(decimals)).slice(0, decimals);
  const combined = `${whole}${frac}`.replace(/^0+(?=\d)/, '') || '0';
  return combined;
}

export function fromBaseUnits(amount: string, decimals: number): string {
  if (!amount || amount === '0') return '0';
  const pad = amount.padStart(decimals + 1, '0');
  const i = pad.length - decimals;
  const whole = pad.slice(0, i).replace(/^0+(?=\d)/, '') || '0';
  const frac = pad.slice(i).replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole;
}

/** Account + every opted-in ASA from algod. No indexer, no junk filter. */
export async function fetchBalances(address: string): Promise<Balances> {
  try {
    const res = await fetch(`${ALGOD_URL}/v2/accounts/${address}`, {
      headers: { Accept: 'application/json' },
    });
    if (res.status === 404) {
      return { holdings: [algoHolding(0)] };
    }
    if (!res.ok) {
      return { holdings: [], error: `algod ${res.status}` };
    }
    const body = (await res.json()) as AlgodAccount;
    const assets = body.assets ?? [];
    const metas = await Promise.all(assets.map((a) => assetMeta(a['asset-id'])));
    return {
      holdings: [
        algoHolding(toDecimal(body.amount ?? 0, 6)),
        ...assets.map((a, i) => ({
          id: a['asset-id'],
          unit: metas[i].unit,
          amount: toDecimal(a.amount, metas[i].decimals),
          decimals: metas[i].decimals,
        })),
      ],
    };
  } catch {
    return { holdings: [], error: 'offline' };
  }
}

export function formatAmount(value: number | null, digits = 4): string {
  if (value === null) return '—';
  if (value === 0) return '0';
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

export function fractionDigits(holding: Holding): number {
  if (holding.id === 0) return 4;
  if (holding.id === USDC_ASA_ID) return 2;
  return Math.min(holding.decimals, 6);
}

export function truncateAddress(address: string): string {
  if (address.length < 16) return address;
  return `${address.slice(0, 6)}…${address.slice(-6)}`;
}
