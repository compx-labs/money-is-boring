import { ALGOD_URL, USDC_ASA_ID } from '@/lib/theme';

export type Balances = {
  algo: number | null;
  usdc: number | null;
  error?: string;
};

function microToAlgo(micro: number | bigint): number {
  return Number(micro) / 1_000_000;
}

export async function fetchBalances(address: string): Promise<Balances> {
  try {
    const res = await fetch(`${ALGOD_URL}/v2/accounts/${address}`, {
      headers: { Accept: 'application/json' },
    });
    if (res.status === 404) {
      return { algo: 0, usdc: 0 };
    }
    if (!res.ok) {
      return { algo: null, usdc: null, error: `algod ${res.status}` };
    }
    const body = (await res.json()) as {
      amount?: number | bigint;
      assets?: { 'asset-id': number; amount: number | bigint }[];
    };
    const usdc = body.assets?.find((a) => a['asset-id'] === USDC_ASA_ID);
    return {
      algo: microToAlgo(body.amount ?? 0),
      usdc: usdc ? microToAlgo(usdc.amount) : 0,
    };
  } catch {
    return { algo: null, usdc: null, error: 'offline' };
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

export function truncateAddress(address: string): string {
  if (address.length < 16) return address;
  return `${address.slice(0, 6)}…${address.slice(-6)}`;
}
