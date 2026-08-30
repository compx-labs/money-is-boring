import { Pressable, type PressableProps } from 'react-native';
import { tick } from '@/lib/motion/haptics';

/** Pressable that ticks when the control seats. */
export function HapticPressable({ onPress, ...props }: PressableProps) {
  return (
    <Pressable
      {...props}
      onPress={(event) => {
        tick();
        onPress?.(event);
      }}
    />
  );
}
