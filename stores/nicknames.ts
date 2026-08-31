import { Store } from '@tanstack/react-store';
import { prefs } from '@/lib/prefs';

const KEY = 'nicknames';

export type Nicknames = Record<string, string>;

function load(): Nicknames {
  const raw = prefs.getString(KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const next: Nicknames = {};
    for (const [address, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'string' && value) next[address] = value;
    }
    return next;
  } catch {
    return {};
  }
}

export const nicknamesStore = new Store<Nicknames>(load());

export function setNickname(address: string, value: string) {
  const trimmed = value.trim();
  nicknamesStore.setState((prev) => {
    const next = { ...prev };
    if (trimmed) next[address] = trimmed;
    else delete next[address];
    prefs.set(KEY, JSON.stringify(next));
    return next;
  });
}
