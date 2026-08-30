import { LayoutAnimation, Platform, UIManager } from 'react-native';

/** Shared layout spring — inserts, sheets, and rubber dismiss. */
export const LAYOUT_SPRING = {
  stiffness: 380,
  damping: 28,
  mass: 0.9,
} as const;

export const LAYOUT_INSERT_OFFSET = 24;

/** ζ = c / (2√(km)). LayoutAnimation uses this as springDamping. */
export const LAYOUT_SPRING_DAMPING =
  LAYOUT_SPRING.damping /
  (2 * Math.sqrt(LAYOUT_SPRING.stiffness * LAYOUT_SPRING.mass));

export const LAYOUT_DURATION_MS = 420;

export const DISMISS_DISTANCE = 96;

if (
  Platform.OS === 'android' &&
  typeof UIManager.setLayoutAnimationEnabledExperimental === 'function'
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function layoutSpringConfig(toValue: number, native = true) {
  return {
    toValue,
    stiffness: LAYOUT_SPRING.stiffness,
    damping: LAYOUT_SPRING.damping,
    mass: LAYOUT_SPRING.mass,
    useNativeDriver: native,
  };
}

/** Call before a state change that inserts or removes rows so the list makes room. */
export function prepareLayoutSpring(): void {
  LayoutAnimation.configureNext({
    duration: LAYOUT_DURATION_MS,
    update: {
      type: LayoutAnimation.Types.spring,
      springDamping: LAYOUT_SPRING_DAMPING,
    },
    delete: {
      type: LayoutAnimation.Types.spring,
      property: LayoutAnimation.Properties.scaleY,
      springDamping: LAYOUT_SPRING_DAMPING,
    },
  });
}

/** Rubber a drag past the rest position (pull up). Same spring on release. */
export function rubberOffset(dy: number): number {
  if (dy >= 0) return dy;
  return dy / (1 - dy / 140);
}
