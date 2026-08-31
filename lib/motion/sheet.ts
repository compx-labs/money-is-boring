import { LAYOUT_DURATION_MS } from '@/lib/motion/layout';

/** Magenta parallelogram on the top edge — same 2px weight as the nav stroke. */
export const SHEET_LIP = 2;
/** Grabber: a short sheared dash, not a rounded pill. */
export const SHEET_HANDLE_WIDTH = 40;
export const SHEET_HANDLE_HEIGHT = 5;

/**
 * Transparent host so SheetScaffold can spring the card with the shared
 * layout spring. Native stack animation stays off — we move the card.
 */
export const sheetScreenOptions = {
  headerShown: false,
  presentation: 'containedTransparentModal' as const,
  animation: 'none' as const,
  animationDuration: LAYOUT_DURATION_MS,
  gestureEnabled: false,
  contentStyle: { backgroundColor: 'transparent' },
};
