import { StyleSheet, View } from 'react-native';
import { useChrome } from '@/hooks/useChrome';

/** Canvas fill — follows light/dark chrome. */
export function BackgroundTexture() {
  const { bg } = useChrome();
  return <View pointerEvents="none" style={[styles.fill, { backgroundColor: bg }]} />;
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
});
