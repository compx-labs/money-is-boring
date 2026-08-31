import { useStore } from '@tanstack/react-store';
import { CHROME, type Chrome } from '@/lib/theme';
import { colorModeStore } from '@/stores/colorMode';

export function useChrome(): Chrome {
  return useStore(colorModeStore, (mode) => CHROME[mode]);
}
