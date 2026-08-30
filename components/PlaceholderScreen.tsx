import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '@/lib/theme';

export function PlaceholderScreen({ title, hint }: { title: string; hint: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top + 36 }]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 28,
    gap: 16,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 44,
  },
  hint: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 26,
    lineHeight: 36,
  },
});
