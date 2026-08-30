import { TINYMAN_ASA_LIST_URL } from '@/lib/theme';

type AsaListEntry = {
  id?: string;
  logo?: { png?: string; svg?: string };
};

const EMPTY = new Map<number, string>();

let cache: Map<number, string> | null = null;
let inflight: Promise<Map<number, string>> | null = null;

export function getCachedAsaIcons(): Map<number, string> {
  return cache ?? EMPTY;
}

/** Load Tinyman assets.json once; maps ASA id → PNG icon URL. */
export function loadAsaIcons(): Promise<Map<number, string>> {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;

  inflight = (async () => {
    const res = await fetch(TINYMAN_ASA_LIST_URL, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`asa-list ${res.status}`);
    const body = (await res.json()) as Record<string, AsaListEntry>;
    const next = new Map<number, string>();
    for (const [id, entry] of Object.entries(body)) {
      const png = entry.logo?.png;
      if (!png) continue;
      const n = Number(id);
      if (Number.isFinite(n)) next.set(n, png);
    }
    cache = next;
    return next;
  })();

  return inflight.finally(() => {
    if (!cache) inflight = null;
  });
}
