import { useStore } from '@tanstack/react-store';
import { resolveAccent, type AccentTheme } from '@/lib/theme';
import { accentStore } from '@/stores/accent';
import { colorModeStore } from '@/stores/colorMode';

export function useAccent(): AccentTheme {
  const id = useStore(accentStore, (state) => state);
  const mode = useStore(colorModeStore, (state) => state);
  return resolveAccent(id, mode);
}
