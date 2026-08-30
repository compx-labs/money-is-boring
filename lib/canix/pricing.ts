import { CANIX_URL } from '@/lib/theme';

export type TokenPrice = {
  assetId: number;
  priceUsd: number | null;
};

type PricingResponse = {
  data?: {
    prices?: { assetId?: string | number; priceUsd?: number | null }[];
  };
};

/** CompX USD oracle via Canix402. Free — no x402. */
export async function fetchUsdPrices(assetIds: number[]): Promise<Map<number, number | null>> {
  const unique = [...new Set(assetIds)].filter((id) => Number.isInteger(id) && id >= 0);
  const prices = new Map<number, number | null>();
  if (unique.length === 0) return prices;

  const res = await fetch(`${CANIX_URL}/pricing`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ assetIds: unique.slice(0, 100) }),
  });
  if (!res.ok) throw new Error(`pricing ${res.status}`);

  const body = (await res.json()) as PricingResponse;
  for (const row of body.data?.prices ?? []) {
    const id = Number(row.assetId);
    if (!Number.isInteger(id)) continue;
    const usd = row.priceUsd;
    prices.set(id, typeof usd === 'number' && Number.isFinite(usd) ? usd : null);
  }
  return prices;
}
