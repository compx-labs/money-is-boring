import { StyleSheet, View } from 'react-native';
import { colors } from '@/lib/theme';

/** Plain off-white canvas. */
export function BackgroundTexture() {
  return <View pointerEvents="none" style={styles.fill} />;
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
  },
});
