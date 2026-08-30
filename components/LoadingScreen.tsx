import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/lib/theme';

export function LoadingScreen() {
  return (
    <View style={styles.wrap}>
      <ActivityIndicator color={colors.cubeTop} />
      <Text style={styles.label}>unlocking</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  label: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 28,
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
});
