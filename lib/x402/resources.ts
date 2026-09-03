import { GOPLAUSIBLE_URL } from '@/lib/theme';

export type CatalogedResource = {
  resourceUrl?: unknown;
  method?: unknown;
  description?: unknown;
  discoveryInfo?: unknown;
  type?: unknown;
  merchantId?: unknown;
};

type ResourcesResponse = {
  items?: CatalogedResource[];
  pagination?: { limit?: unknown; offset?: unknown; total?: unknown };
};

type DataMerchantResource = {
  url?: unknown;
  resourceUrl?: unknown;
  method?: unknown;
  description?: unknown;
};

type DataMerchantDetail = {
  website?: unknown;
  origin?: unknown;
  domain?: unknown;
  resources?: DataMerchantResource[] | null;
};

const JSON_HEADERS = { Accept: 'application/json' };
const PAGE = 100;

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

/** Hostname for matching Explore merchants to bazaar resources. Data ids are not bazaar ids. */
export function resourceHost(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  try {
    const url = raw.includes('://') ? new URL(raw) : new URL(`https://${raw}`);
    const host = url.hostname.trim().toLowerCase();
    return host || null;
  } catch {
    return null;
  }
}

function mapDataResources(resources: DataMerchantResource[] | null | undefined): CatalogedResource[] {
  if (!Array.isArray(resources)) return [];
  const seen = new Set<string>();
  const out: CatalogedResource[] = [];
  for (const row of resources) {
    const url = text(row?.url) ?? text(row?.resourceUrl);
    if (!url) continue;
    const method = (text(row?.method) ?? 'GET').toUpperCase();
    const key = `${method} ${url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      resourceUrl: url,
      method,
      description: text(row?.description) ?? url,
    });
  }
  return out;
}

async function paginateSearch(query: string): Promise<CatalogedResource[]> {
  const out: CatalogedResource[] = [];
  let offset = 0;
  let total = Infinity;
  const encoded = encodeURIComponent(query);

  while (offset < total) {
    const body = await fetchJson<ResourcesResponse>(
      `/discovery/resources?search=${encoded}&limit=${PAGE}&offset=${offset}`,
    );
    const items = body.items ?? [];
    const pagination = body.pagination ?? {};
    total = typeof pagination.total === 'number' ? pagination.total : offset + items.length;
    out.push(...items);
    if (items.length === 0) break;
    offset += items.length;
  }

  return out;
}

function matchingHost(resources: CatalogedResource[], host: string): CatalogedResource[] {
  return resources.filter((resource) => resourceHost(resource.resourceUrl) === host);
}

/**
 * Bazaar HTTP/MCP catalog for one Explore merchant.
 * `/discovery/resources?merchantId=` expects a bazaar id, not the 16-hex data id
 * on Explore rows — look up by origin host, then the data merchant's resources list.
 */
export async function listMerchantResources(merchant: {
  id: string;
  url?: string | null;
}): Promise<CatalogedResource[]> {
  const tried = new Set<string>();

  const fromHost = async (host: string | null): Promise<CatalogedResource[] | null> => {
    if (!host || tried.has(host)) return null;
    tried.add(host);
    const matched = matchingHost(await paginateSearch(host), host);
    return matched.length > 0 ? matched : null;
  };

  const fromUrl = await fromHost(resourceHost(merchant.url));
  if (fromUrl) return fromUrl;

  const detail = await fetchJson<DataMerchantDetail>(`/data/merchants/${encodeURIComponent(merchant.id)}`);
  const fromDetail = await fromHost(
    resourceHost(detail.website) ?? resourceHost(detail.origin) ?? resourceHost(detail.domain),
  );
  if (fromDetail) return fromDetail;

  return mapDataResources(detail.resources);
}
