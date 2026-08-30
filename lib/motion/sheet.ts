import { colors } from '@/lib/theme';
import { LAYOUT_DURATION_MS } from '@/lib/motion/layout';

/**
 * Transparent host so SheetScaffold can spring the card with the shared
 * layout spring. Native stack animation stays off — we move the card.
 */
export const sheetScreenOptions = {
  headerShown: false,
  presentation: 'transparentModal' as const,
  animation: 'none' as const,
  animationDuration: LAYOUT_DURATION_MS,
  gestureEnabled: false,
  contentStyle: { backgroundColor: 'transparent' },
};
