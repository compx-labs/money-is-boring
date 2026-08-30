import React from 'react';
import { getCachedAsaIcons, loadAsaIcons } from '@/lib/algorand/asa-list';

/** Tinyman PNG URLs keyed by ASA id. Fetches assets.json once per session. */
export function useAsaIcons(): Map<number, string> {
  const [icons, setIcons] = React.useState(getCachedAsaIcons);

  React.useEffect(() => {
    let alive = true;
    loadAsaIcons()
      .then((map) => {
        if (alive) setIcons(map);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return icons;
}
