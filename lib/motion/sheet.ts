import { colors } from '@/lib/theme';
import { thud } from '@/lib/motion/haptics';

/** Native iOS/Android bottom card. Reused by swap, send, and receive. */
export const sheetScreenOptions = {
  headerShown: false,
  presentation: 'formSheet' as const,
  animation: 'slide_from_bottom' as const,
  sheetGrabberVisible: true,
  sheetAllowedDetents: [1] as number[],
  sheetCornerRadius: 24,
  contentStyle: { backgroundColor: colors.bg },
};

/** Soft thud when the card finishes sliding up. */
export const sheetListeners = {
  transitionEnd: (e: { data: { closing: boolean } }) => {
    if (e.data.closing) return;
    thud();
  },
};
