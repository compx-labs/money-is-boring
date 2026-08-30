import React from 'react';
import {
  AccessibilityInfo,
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chamfer } from '@/components/Chamfer';
import { thud } from '@/lib/motion/haptics';
import {
  DISMISS_DISTANCE,
  layoutSpringConfig,
  rubberOffset,
} from '@/lib/motion/layout';
import {
  SHEET_GUTTER,
  SHEET_HANDLE_HEIGHT,
  SHEET_HANDLE_WIDTH,
  SHEET_LIP,
} from '@/lib/motion/sheet';
import { BackgroundTexture } from '@/components/BackgroundTexture';
import { colors } from '@/lib/theme';

const SheetDismiss = React.createContext<(() => void) | null>(null);

export function useSheetDismiss(): () => void {
  const dismiss = React.useContext(SheetDismiss);
  const router = useRouter();
  return dismiss ?? (() => router.back());
}

const HANDLE_HIT = 22;
const CHROME = SHEET_LIP + HANDLE_HIT;

/** Bottom card: off-white, light shadow, sheared magenta lip. Height hugs content. */
export function SheetScaffold({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const translateY = React.useRef(new Animated.Value(height)).current;
  const closing = React.useRef(false);
  const [reduceMotion, setReduceMotion] = React.useState(false);
  const [bodyH, setBodyH] = React.useState(0);

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

  const bottom = Math.max(insets.bottom, SHEET_GUTTER);
  const maxH = height - insets.top - SHEET_GUTTER;
  const bodyMax = Math.max(120, maxH - CHROME);
  const capped = bodyH > bodyMax;

  const onBodyLayout = React.useCallback(
    (event: LayoutChangeEvent) => {
      const next = event.nativeEvent.layout.height;
      setBodyH((prev) => {
        if (capped) return prev;
        return Math.abs(prev - next) < 1 ? prev : next;
      });
    },
    [capped],
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
        <Animated.View
          style={[
            styles.lift,
            {
              left: SHEET_GUTTER,
              right: SHEET_GUTTER,
              bottom,
              maxHeight: maxH,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.card}>
            <BackgroundTexture />
            <View style={styles.chrome} {...pan.panHandlers}>
              <Chamfer fill={colors.button} style={styles.lip} />
              <View style={styles.handleHit}>
                <Chamfer fill={colors.button} style={styles.handle} />
              </View>
            </View>
            <View
              onLayout={capped ? undefined : onBodyLayout}
              style={capped ? { height: bodyMax } : styles.bodyWrap}
            >
              {capped ? (
                <ScrollView
                  style={styles.bodyScroll}
                  contentContainerStyle={styles.body}
                  bounces={false}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {children}
                </ScrollView>
              ) : (
                children
              )}
            </View>
          </View>
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
  lift: {
    position: 'absolute',
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 12,
  },
  card: {
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  chrome: {
    alignSelf: 'stretch',
    zIndex: 1,
  },
  lip: {
    alignSelf: 'stretch',
    height: SHEET_LIP,
  },
  handleHit: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {
    width: SHEET_HANDLE_WIDTH,
    height: SHEET_HANDLE_HEIGHT,
  },
  bodyWrap: {
    alignSelf: 'stretch',
  },
  bodyScroll: {
    flex: 1,
  },
  body: {
    flexGrow: 0,
  },
});
