import React from 'react';
import {
  AccessibilityInfo,
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { thud } from '@/lib/motion/haptics';
import {
  DISMISS_DISTANCE,
  layoutSpringConfig,
  rubberOffset,
} from '@/lib/motion/layout';
import { colors } from '@/lib/theme';

const SheetDismiss = React.createContext<(() => void) | null>(null);

export function useSheetDismiss(): () => void {
  const dismiss = React.useContext(SheetDismiss);
  const router = useRouter();
  return dismiss ?? (() => router.back());
}

/** Bottom card that springs in, settles, and rubber-bands on drag-dismiss. */
export function SheetScaffold({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const translateY = React.useRef(new Animated.Value(height)).current;
  const closing = React.useRef(false);
  const [reduceMotion, setReduceMotion] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (alive) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  const settle = React.useCallback(
    (to: number, then?: () => void) => {
      if (reduceMotion) {
        translateY.setValue(to);
        then?.();
        return;
      }
      Animated.spring(translateY, layoutSpringConfig(to)).start(({ finished }) => {
        if (finished) then?.();
      });
    },
    [reduceMotion, translateY],
  );

  React.useEffect(() => {
    settle(0, thud);
  }, [settle]);

  const dismiss = React.useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    settle(height, () => router.back());
  }, [height, router, settle]);

  const pan = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
        onPanResponderMove: (_, g) => {
          translateY.setValue(rubberOffset(g.dy));
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy > DISMISS_DISTANCE || g.vy > 1.15) {
            dismiss();
            return;
          }
          settle(0);
        },
        onPanResponderTerminate: () => settle(0),
      }),
    [dismiss, settle, translateY],
  );

  return (
    <SheetDismiss.Provider value={dismiss}>
      <View style={styles.fill}>
        <Pressable
          style={styles.backdrop}
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />
        <Animated.View style={[styles.card, { transform: [{ translateY }] }]}>
          <View style={styles.handleHit} {...pan.panHandlers}>
            <View style={styles.grabber} />
          </View>
          <View style={styles.body}>{children}</View>
        </Animated.View>
      </View>
    </SheetDismiss.Provider>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    flex: 1,
    marginTop: 12,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  handleHit: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 6,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
  },
  body: {
    flex: 1,
  },
});
