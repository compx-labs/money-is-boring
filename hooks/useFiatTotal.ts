import React from 'react';
import { fetchUsdPrices } from '@/lib/canix/pricing';
import type { Holding } from '@/lib/algorand/balances';

export const PRICE_POLL_MS = 30_000;

function assetKey(holdings: Holding[]): string {
  return holdings
    .map((h) => h.id)
    .sort((a, b) => a - b)
    .join(',');
}

/** USD total of wallet holdings from the free Canix402 pricing oracle. */
export function useFiatTotal(holdings: Holding[]): number | null {
  const [prices, setPrices] = React.useState<Map<number, number | null>>(new Map());
  const ids = assetKey(holdings);

  React.useEffect(() => {
    if (!ids) return;

    let cancelled = false;
    let inFlight = false;
    const assetIds = ids.split(',').map(Number);

    const tick = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const next = await fetchUsdPrices(assetIds);
        if (!cancelled) setPrices(next);
      } catch {
        /* keep last good prices */
      } finally {
        inFlight = false;
      }
    };

    tick();
    const timer = setInterval(tick, PRICE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [ids]);

  return React.useMemo(() => {
    if (prices.size === 0) return null;
    let total = 0;
    let priced = false;
    for (const holding of holdings) {
      if (holding.amount == null) continue;
      const usd = prices.get(holding.id);
      if (usd == null) continue;
      total += holding.amount * usd;
      priced = true;
    }
    return priced ? total : null;
  }, [holdings, prices]);
}
