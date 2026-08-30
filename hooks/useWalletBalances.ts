import React from 'react';
import {
  BALANCE_POLL_MS,
  emptyBalances,
  fetchBalances,
  type Balances,
} from '@/lib/algorand/balances';

/** Poll algod every 10s for all holdings. Stops when the screen unmounts. */
export function useWalletBalances(address: string): Balances {
  const [balances, setBalances] = React.useState<Balances>(emptyBalances);

  React.useEffect(() => {
    if (!address) return;

    let cancelled = false;
    let inFlight = false;

    const tick = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const next = await fetchBalances(address);
        if (cancelled) return;
        setBalances((prev) => {
          if (next.error && prev.holdings.length > 0) {
            return { holdings: prev.holdings, error: next.error };
          }
          return next;
        });
      } finally {
        inFlight = false;
      }
    };

    tick();
    const id = setInterval(tick, BALANCE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [address]);

  return balances;
}
