import React from 'react';
import { AccessibilityInfo, Animated, type StyleProp, type ViewStyle } from 'react-native';
import { LAYOUT_INSERT_OFFSET, layoutSpringConfig } from '@/lib/motion/layout';

/** New activity slides in. Pair with prepareLayoutSpring so the list makes room. */
export function SpringInsert({
  children,
  active = true,
  style,
}: {
  children: React.ReactNode;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const y = React.useRef(new Animated.Value(active ? LAYOUT_INSERT_OFFSET : 0)).current;
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
    if (!active) {
      y.setValue(0);
      return;
    }
    if (reduceMotion) {
      y.setValue(0);
      return;
    }
    const motion = Animated.spring(y, layoutSpringConfig(0));
    motion.start();
    return () => motion.stop();
  }, [active, reduceMotion, y]);

  return <Animated.View style={[style, { transform: [{ translateY: y }] }]}>{children}</Animated.View>;
}
