import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/lib/theme';

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
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  label: {
    color: colors.muted,
    fontSize: 14,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
