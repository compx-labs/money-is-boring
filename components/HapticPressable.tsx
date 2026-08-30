import React from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  type PressableProps,
} from 'react-native';
import { tick } from '@/lib/motion/haptics';
import { pressInSpring, pressOutSpring } from '@/lib/motion/press';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Tick when the control seats, plus the shared ~0.97 press spring. */
export function HapticPressable({
  onPress,
  onPressIn,
  onPressOut,
  style,
  disabled,
  ...props
}: PressableProps) {
  const scale = React.useRef(new Animated.Value(1)).current;
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

  const to = (pressed: boolean) => {
    if (disabled) return;
    if (reduceMotion) {
      scale.setValue(pressed ? pressInSpring.toValue : 1);
      return;
    }
    Animated.spring(scale, pressed ? pressInSpring : pressOutSpring).start();
  };

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPressIn={(event) => {
        to(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        to(false);
        onPressOut?.(event);
      }}
      onPress={(event) => {
        tick();
        onPress?.(event);
      }}
      style={(state) => [typeof style === 'function' ? style(state) : style, { transform: [{ scale }] }]}
    />
  );
}
