import { useStore } from '@tanstack/react-store';
import { colorModeStore } from '@/stores/colorMode';
import type { ColorMode } from '@/lib/theme';

export function useColorMode(): ColorMode {
  return useStore(colorModeStore, (state) => state);
}
