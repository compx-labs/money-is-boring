import React, { type ComponentProps } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ICON_MORPH_MS } from '@/lib/motion/icon';

type IconName = ComponentProps<typeof Ionicons>['name'];

const bounceUp = Math.round(ICON_MORPH_MS * 0.58);
const bounceDown = ICON_MORPH_MS - bounceUp;

/**
 * SF Symbol-style swap: crossfade + scale, 240ms, one shot.
 * `bounce` plays a select bounce when it becomes true (not on first paint).
 */
export function MorphIcon({
  name,
  size,
  color,
  bounce = false,
}: {
  name: IconName;
  size: number;
  color: string;
  bounce?: boolean;
}) {
  const [shown, setShown] = React.useState(name);
  const progress = React.useRef(new Animated.Value(1)).current;
  const bounceScale = React.useRef(new Animated.Value(1)).current;
  const prevBounce = React.useRef(bounce);
  const mounted = React.useRef(false);
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

  React.useEffect(() => {
    if (name === shown) {
      progress.setValue(1);
      return;
    }
    if (reduceMotion) {
      setShown(name);
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const motion = Animated.timing(progress, {
      toValue: 1,
      duration: ICON_MORPH_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    motion.start(({ finished }) => {
      if (finished) {
        setShown(name);
        progress.setValue(1);
      }
    });
    return () => {
      motion.stop();
      progress.setValue(1);
    };
  }, [name, progress, reduceMotion, shown]);

  React.useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      prevBounce.current = bounce;
      return;
    }
    const rose = bounce && !prevBounce.current;
    prevBounce.current = bounce;
    if (!rose) return;
    if (reduceMotion) {
      bounceScale.setValue(1);
      return;
    }
    bounceScale.setValue(0.86);
    const motion = Animated.sequence([
      Animated.timing(bounceScale, {
        toValue: 1.14,
        duration: bounceUp,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(bounceScale, {
        toValue: 1,
        duration: bounceDown,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    motion.start(({ finished }) => {
      if (finished) bounceScale.setValue(1);
    });
    return () => {
      motion.stop();
      bounceScale.setValue(1);
    };
  }, [bounce, bounceScale, reduceMotion]);

  const incoming = name !== shown;
  const outgoingOpacity = React.useMemo(
    () =>
      progress.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0],
      }),
    [progress],
  );
  const incomingOpacity = React.useMemo(
    () =>
      progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
      }),
    [progress],
  );
  const outgoingScale = React.useMemo(
    () =>
      progress.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0.72],
      }),
    [progress],
  );
  const incomingScale = React.useMemo(
    () =>
      progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0.72, 1],
      }),
    [progress],
  );

  return (
    <Animated.View style={{ transform: [{ scale: bounceScale }] }}>
      <View style={{ width: size, height: size }}>
        <Animated.View
          style={[
            styles.layer,
            incoming
              ? { opacity: outgoingOpacity, transform: [{ scale: outgoingScale }] }
              : { opacity: 1 },
          ]}
        >
          <Ionicons name={shown} size={size} color={color} />
        </Animated.View>
        {incoming ? (
          <Animated.View
            style={[
              styles.layer,
              { opacity: incomingOpacity, transform: [{ scale: incomingScale }] },
            ]}
          >
            <Ionicons name={name} size={size} color={color} />
          </Animated.View>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
