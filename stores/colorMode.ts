import { Store } from '@tanstack/react-store';
import { prefs } from '@/lib/prefs';
import { isColorMode, type ColorMode } from '@/lib/theme';

const KEY = 'colorMode';
const DEFAULT: ColorMode = 'light';

function load(): ColorMode {
  const raw = prefs.getString(KEY);
  return raw && isColorMode(raw) ? raw : DEFAULT;
}

export const colorModeStore = new Store<ColorMode>(load());

export function setColorMode(mode: ColorMode) {
  if (!isColorMode(mode)) return;
  colorModeStore.setState(() => mode);
  prefs.set(KEY, mode);
}
