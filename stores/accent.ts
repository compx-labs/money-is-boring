import { Store } from '@tanstack/react-store';
import { prefs } from '@/lib/prefs';
import { THEMES, isAccentId, type AccentId } from '@/lib/theme';

const KEY = 'accent';
const DEFAULT: AccentId = 'pink';

function load(): AccentId {
  const raw = prefs.getString(KEY);
  return raw && isAccentId(raw) ? raw : DEFAULT;
}

export const accentStore = new Store<AccentId>(load());

export function setAccent(id: AccentId) {
  if (!THEMES[id]) return;
  accentStore.setState(() => id);
  prefs.set(KEY, id);
}
