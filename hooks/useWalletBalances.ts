import React from 'react';
import {
  BALANCE_POLL_MS,
  emptyBalances,
  fetchBalances,
  type Balances,
} from '@/lib/algorand/balances';
import { prepareLayoutSpring } from '@/lib/motion/layout';

/** Poll algod every 10s for all holdings. Stops when the screen unmounts. */
export function useWalletBalances(address: string): Balances & { refresh: () => void } {
  const [balances, setBalances] = React.useState<Balances>(emptyBalances);
  const refreshRef = React.useRef<() => void>(() => {});

  React.useEffect(() => {
    if (!address) return;

    let cancelled = false;
    let generation = 0;

    const tick = async () => {
      const mine = ++generation;
      const next = await fetchBalances(address);
      if (cancelled || mine !== generation) return;
      setBalances((prev) => {
        if (next.error && prev.holdings.length > 0) {
          return { holdings: prev.holdings, error: next.error };
        }
        if (next.holdings.length !== prev.holdings.length) {
          prepareLayoutSpring();
        }
        return next;
      });
    };

    refreshRef.current = () => {
      void tick();
    };
    tick();
    const id = setInterval(tick, BALANCE_POLL_MS);
    return () => {
      cancelled = true;
      refreshRef.current = () => {};
      clearInterval(id);
    };
  }, [address]);

  const refresh = React.useCallback(() => {
    refreshRef.current();
  }, []);

  return { ...balances, refresh };
}
