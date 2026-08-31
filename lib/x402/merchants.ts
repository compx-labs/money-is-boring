import { GOPLAUSIBLE_URL } from '@/lib/theme';

export type X402Merchant = {
  id: string;
  name: string;
  description: string;
  logo: string;
  url: string | null;
  firstSeen: number | null;
  lastSeen: number | null;
  settles: number | null;
  volume: number | null;
};

type DiscoveryMerchant = {
  id?: unknown;
  addresses?: Record<string, unknown>;
};

type DiscoveryResponse = {
  items?: DiscoveryMerchant[];
  pagination?: { limit?: unknown; offset?: unknown; total?: unknown };
};

type DataMerchantListItem = {
  id?: unknown;
  address?: unknown;
};

type DataMerchantsResponse = {
  items?: DataMerchantListItem[];
};

type DataMerchantSite = {
  title?: unknown;
  siteName?: unknown;
  description?: unknown;
  logo?: unknown;
};

type DataMerchantDetail = {
  id?: unknown;
  address?: unknown;
  name?: unknown;
  description?: unknown;
  logo?: unknown;
  website?: unknown;
  origin?: unknown;
  domain?: unknown;
  firstSeen?: unknown;
  lastSeen?: unknown;
  settles?: unknown;
  volume?: unknown;
  site?: DataMerchantSite | null;
};

const JSON_HEADERS = { Accept: 'application/json' };
const DISCOVERY_PAGE = 100;
const DETAIL_CONCURRENCY = 6;

let cache: X402Merchant[] | null = null;
let inflight: Promise<X402Merchant[]> | null = null;

export function getCachedX402Merchants(): X402Merchant[] | null {
  return cache;
}

export function getCachedMerchant(id: string): X402Merchant | undefined {
  return cache?.find((merchant) => merchant.id === id);
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${GOPLAUSIBLE_URL}${path}`, { headers: JSON_HEADERS });
  if (!res.ok) throw new Error(`goplausible ${res.status}`);
  return (await res.json()) as T;
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function looksLikeAddress(name: string): boolean {
  if (name.includes('…') || name.includes('...')) return true;
  if (/^0x[0-9a-fA-F]{40}$/.test(name)) return true;
  if (/^[A-Z2-7]{58}$/.test(name)) return true;
  if (name.length >= 32 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(name)) return true;
  return false;
}

function properName(value: unknown): string | null {
  const name = text(value);
  if (!name || looksLikeAddress(name)) return null;
  return name;
}

function httpsUrl(value: unknown): string | null {
  const url = text(value);
  if (!url || !url.startsWith('https://')) return null;
  return url;
}

function asId(value: unknown): string | null {
  return text(value);
}

function millis(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string') {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber) && asNumber > 0) return asNumber;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function merchantUrl(detail: DataMerchantDetail): string | null {
  const domain = text(detail.domain);
  return httpsUrl(detail.website) ?? httpsUrl(detail.origin) ?? (domain ? `https://${domain}` : null);
}

function maskedInRegistry(masked: string, registered: Set<string>): boolean {
  const parts = masked.split(/\u2026|\.\.\./);
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
  const prefix = parts[0].toLowerCase();
  const suffix = parts[1].toLowerCase();
  for (const address of registered) {
    if (address.startsWith(prefix) && address.endsWith(suffix)) return true;
  }
  return false;
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      out[index] = await fn(items[index]);
    }
  }
  const workers = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return out;
}

async function listDiscoveryAddresses(): Promise<Set<string>> {
  const addresses = new Set<string>();
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const body = await fetchJson<DiscoveryResponse>(
      `/discovery/merchants?limit=${DISCOVERY_PAGE}&offset=${offset}`,
    );
    const items = body.items ?? [];
    const pagination = body.pagination ?? {};
    total = typeof pagination.total === 'number' ? pagination.total : offset + items.length;

    for (const merchant of items) {
      for (const value of Object.values(merchant.addresses ?? {})) {
        const address = text(value);
        if (address) addresses.add(address.toLowerCase());
      }
    }

    if (items.length === 0) break;
    offset += items.length;
  }

  return addresses;
}

function mapDetail(detail: DataMerchantDetail): X402Merchant | null {
  const id = asId(detail.id);
  const name =
    properName(detail.name) ??
    properName(detail.site?.siteName) ??
    properName(detail.site?.title);
  const logo = httpsUrl(detail.logo) ?? httpsUrl(detail.site?.logo);
  const description = text(detail.description) ?? text(detail.site?.description);
  if (!id || !name || !logo || !description) return null;

  return {
    id,
    name,
    description,
    logo,
    url: merchantUrl(detail),
    firstSeen: millis(detail.firstSeen),
    lastSeen: millis(detail.lastSeen),
    settles: finiteNumber(detail.settles),
    volume: finiteNumber(detail.volume),
  };
}

function toMerchant(detail: DataMerchantDetail, registered: Set<string>): X402Merchant | null {
  const address = text(detail.address);
  if (!address || !registered.has(address.toLowerCase())) return null;
  return mapDetail(detail);
}

const PINNED_NAMES = ['canix402', 'amarok'];

function pinRank(name: string): number {
  const key = name.trim().toLowerCase();
  const index = PINNED_NAMES.findIndex((pinned) => key === pinned || key.startsWith(pinned));
  return index === -1 ? PINNED_NAMES.length : index;
}

/** Registered GoPlausible merchants with a logo, human name, and description. */
export function loadX402Merchants(): Promise<X402Merchant[]> {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;

  inflight = (async () => {
    const [registered, listed] = await Promise.all([
      listDiscoveryAddresses(),
      fetchJson<DataMerchantsResponse>('/data/merchants?range=all&limit=100'),
    ]);

    const candidates = (listed.items ?? [])
      .map((item) => ({ id: asId(item.id), address: text(item.address) }))
      .filter((item): item is { id: string; address: string } => {
        return item.id != null && item.address != null && maskedInRegistry(item.address, registered);
      });

    const details = await mapPool(candidates, DETAIL_CONCURRENCY, (item) =>
      fetchJson<DataMerchantDetail>(`/data/merchants/${item.id}`),
    );

    const next: X402Merchant[] = [];
    const seen = new Set<string>();
    for (const detail of details) {
      const merchant = toMerchant(detail, registered);
      if (!merchant || seen.has(merchant.id)) continue;
      seen.add(merchant.id);
      next.push(merchant);
    }
    next.sort((a, b) => pinRank(a.name) - pinRank(b.name));

    cache = next;
    return next;
  })();

  return inflight.finally(() => {
    if (!cache) inflight = null;
  });
}

/** One merchant by facilitator id. Uses the list cache when warm. */
export async function loadX402Merchant(id: string): Promise<X402Merchant> {
  const cached = getCachedMerchant(id);
  if (cached) return cached;
  if (inflight) {
    const list = await inflight;
    const hit = list.find((merchant) => merchant.id === id);
    if (hit) return hit;
  }
  const detail = await fetchJson<DataMerchantDetail>(`/data/merchants/${id}`);
  const merchant = mapDetail(detail);
  if (!merchant) throw new Error('merchant not found');
  return merchant;
}
