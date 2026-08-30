/** Shared press squash. One scale for every tappable control. */
export const PRESS_SCALE = 0.97;

export const pressInSpring = {
  toValue: PRESS_SCALE,
  stiffness: 520,
  damping: 32,
  mass: 0.45,
  useNativeDriver: true,
} as const;

export const pressOutSpring = {
  toValue: 1,
  stiffness: 340,
  damping: 14,
  mass: 0.7,
  useNativeDriver: true,
} as const;
