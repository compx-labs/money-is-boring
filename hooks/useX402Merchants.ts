import React from 'react';
import { getCachedX402Merchants, loadX402Merchants, type X402Merchant } from '@/lib/x402/merchants';

/** GoPlausible x402 merchants with name, logo, and description. Loads once per session. */
export function useX402Merchants(): {
  merchants: X402Merchant[];
  loading: boolean;
  error: boolean;
} {
  const cached = getCachedX402Merchants();
  const [merchants, setMerchants] = React.useState<X402Merchant[]>(cached ?? []);
  const [loading, setLoading] = React.useState(cached == null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    loadX402Merchants()
      .then((list) => {
        if (!alive) return;
        setMerchants(list);
        setError(false);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { merchants, loading, error };
}
