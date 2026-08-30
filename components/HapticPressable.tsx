import React from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { tick } from '@/lib/motion/haptics';
import { pressInSpring, pressOutSpring } from '@/lib/motion/press';

type PressableStyle = PressableProps['style'];

function layoutFrom(style: PressableStyle): ViewStyle {
  const resolved = typeof style === 'function' ? style({ pressed: false }) : style;
  const flat = StyleSheet.flatten(resolved as StyleProp<ViewStyle>) ?? {};
  return {
    flex: flat.flex,
    flexGrow: flat.flexGrow,
    flexShrink: flat.flexShrink,
    flexBasis: flat.flexBasis,
    alignSelf: flat.alignSelf,
    width: flat.width,
    height: flat.height,
    minWidth: flat.minWidth,
    minHeight: flat.minHeight,
    maxWidth: flat.maxWidth,
    maxHeight: flat.maxHeight,
  };
}

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
    <Animated.View style={[layoutFrom(style), { transform: [{ scale }] }]}>
      <Pressable
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
        style={style}
      />
    </Animated.View>
  );
}
