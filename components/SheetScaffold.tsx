import React from 'react';
import {
  AccessibilityInfo,
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type KeyboardEvent,
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
  SHEET_HANDLE_HEIGHT,
  SHEET_HANDLE_WIDTH,
  SHEET_LIP,
} from '@/lib/motion/sheet';
import { useAccent } from '@/hooks/useAccent';
import { useChrome } from '@/hooks/useChrome';

const SheetDismiss = React.createContext<(() => void) | null>(null);

export function useSheetDismiss(): () => void {
  const dismiss = React.useContext(SheetDismiss);
  const router = useRouter();
  return (
    dismiss ??
    (() => {
      if (router.canDismiss()) router.dismiss();
      else router.back();
    })
  );
}

export type SheetPalette = {
  surface: string;
  ink: string;
};

const SheetChrome = React.createContext<SheetPalette | null>(null);

export function useSheetPalette(): SheetPalette | null {
  return React.useContext(SheetChrome);
}

const HANDLE_HIT = 22;
const CHROME = SHEET_LIP + HANDLE_HIT;
/** Pop the modal once the card is off-screen — don't wait for the spring to rest. */
const POP_AFTER_MS = 260;
/** Real keyboards are 200+; leftover accessory / home-indicator frames are smaller. */
const KEYBOARD_VISIBLE_MIN = 120;

function keyboardEasing(event: KeyboardEvent) {
  switch (event.easing) {
    case 'easeIn':
      return Easing.in(Easing.ease);
    case 'easeOut':
      return Easing.out(Easing.ease);
    case 'easeInEaseOut':
      return Easing.inOut(Easing.ease);
    case 'linear':
      return Easing.linear;
    default:
      return Easing.bezier(0.17, 0.59, 0.4, 0.77);
  }
}

function keyboardInset(event: KeyboardEvent): number {
  const overlap = Dimensions.get('screen').height - event.endCoordinates.screenY;
  return overlap >= KEYBOARD_VISIBLE_MIN ? overlap : 0;
}

/** Bottom card: accent fill, chrome-bg lip, flush to the screen edges. Height hugs content unless `heightFraction` is set. */
export function SheetScaffold({
  children,
  onDismiss,
  heightFraction,
  dismissible = true,
}: {
  children: React.ReactNode;
  onDismiss?: () => void;
  /** Fraction of the window height. When set, the card stays that tall and scrolls instead of hugging. */
  heightFraction?: number;
  /** When false, backdrop tap and pan-to-dismiss are locked. */
  dismissible?: boolean;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { accent } = useAccent();
  const { bg, ink } = useChrome();
  const palette = React.useMemo<SheetPalette>(
    () => ({ surface: accent, ink: bg }),
    [accent, bg],
  );
  const { height } = useWindowDimensions();
  const translateY = React.useRef(new Animated.Value(height)).current;
  const keyboardLift = React.useRef(new Animated.Value(0)).current;
  const closingRef = React.useRef(false);
  const poppedRef = React.useRef(false);
  const popTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDismissRef = React.useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const dismissibleRef = React.useRef(dismissible);
  dismissibleRef.current = dismissible;
  const [closing, setClosing] = React.useState(false);
  const [reduceMotion, setReduceMotion] = React.useState(false);
  const [bodyH, setBodyH] = React.useState(0);
  const [keyboardH, setKeyboardH] = React.useState(0);

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

  React.useEffect(() => {
    const liftTo = (to: number, event?: KeyboardEvent) => {
      keyboardLift.stopAnimation();
      setKeyboardH(to);
      const duration = event?.duration ?? 0;
      if (reduceMotion || duration <= 0) {
        keyboardLift.setValue(to);
        return;
      }
      Animated.timing(keyboardLift, {
        toValue: to,
        duration,
        easing: event ? keyboardEasing(event) : Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    };

    const onFrame = (event: KeyboardEvent) => {
      liftTo(keyboardInset(event), event);
    };
    const onHide = (event: KeyboardEvent) => {
      liftTo(0, event);
    };

    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      onFrame,
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      onHide,
    );
    const didHide =
      Platform.OS === 'ios' ? Keyboard.addListener('keyboardDidHide', onHide) : null;
    const change =
      Platform.OS === 'ios'
        ? Keyboard.addListener('keyboardWillChangeFrame', onFrame)
        : null;
    return () => {
      show.remove();
      hide.remove();
      didHide?.remove();
      change?.remove();
    };
  }, [keyboardLift, reduceMotion]);

  const popRoute = React.useCallback(() => {
    if (poppedRef.current) return;
    poppedRef.current = true;
    if (popTimer.current) {
      clearTimeout(popTimer.current);
      popTimer.current = null;
    }
    if (router.canDismiss()) router.dismiss();
    else router.back();
  }, [router]);

  React.useEffect(() => {
    return () => {
      if (popTimer.current) clearTimeout(popTimer.current);
    };
  }, []);

  const dismiss = React.useCallback(() => {
    if (!dismissibleRef.current) return;
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    onDismissRef.current?.();
    Keyboard.dismiss();
    if (reduceMotion) {
      translateY.setValue(height);
      popRoute();
      return;
    }
    Animated.spring(translateY, layoutSpringConfig(height)).start();
    popTimer.current = setTimeout(popRoute, POP_AFTER_MS);
  }, [height, popRoute, reduceMotion, translateY]);

  const pan = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          dismissibleRef.current && Math.abs(g.dy) > 4,
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

  const maxH = height - insets.top - keyboardH;
  const bodyMax = Math.max(120, maxH - CHROME);
  const sheetH =
    heightFraction != null ? Math.min(Math.round(height * heightFraction), maxH) : undefined;
  const bodyFixed = sheetH != null ? Math.max(120, sheetH - CHROME) : undefined;
  const hugCapped = bodyFixed == null && bodyH > bodyMax;
  const scrollBody = bodyFixed != null || hugCapped;
  const sheetY = React.useMemo(
    () => Animated.add(translateY, Animated.multiply(keyboardLift, -1)),
    [keyboardLift, translateY],
  );

  const onBodyLayout = React.useCallback(
    (event: LayoutChangeEvent) => {
      const next = event.nativeEvent.layout.height;
      setBodyH((prev) => {
        if (hugCapped) return prev;
        return Math.abs(prev - next) < 1 ? prev : next;
      });
    },
    [hugCapped],
  );

  return (
    <SheetDismiss.Provider value={dismiss}>
      <SheetChrome.Provider value={palette}>
        <View style={styles.fill} pointerEvents={closing ? 'none' : 'auto'}>
          <Pressable
            style={styles.backdrop}
            onPress={dismiss}
            disabled={!dismissible}
            accessible={dismissible}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          />
          <Animated.View
            style={[
              styles.lift,
              {
                left: 0,
                right: 0,
                bottom: 0,
                ...(sheetH != null ? { height: sheetH } : {}),
                maxHeight: maxH,
                transform: [{ translateY: sheetY }],
                shadowColor: ink,
              },
            ]}
          >
            <View style={[styles.card, sheetH != null ? styles.cardFill : null, { backgroundColor: accent }]}>
              <View style={styles.chrome} {...pan.panHandlers}>
                <Chamfer fill={bg} style={styles.lip} />
                <View style={styles.handleHit}>
                  <Chamfer fill={bg} style={styles.handle} />
                </View>
              </View>
              <View
                onLayout={scrollBody ? undefined : onBodyLayout}
                style={scrollBody ? { height: bodyFixed ?? bodyMax } : styles.bodyWrap}
              >
                {scrollBody ? (
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
      </SheetChrome.Provider>
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
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 12,
  },
  card: {
    overflow: 'hidden',
  },
  cardFill: {
    flex: 1,
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
