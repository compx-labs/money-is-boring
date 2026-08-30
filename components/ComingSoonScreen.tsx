import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '@/lib/theme';

export function ComingSoonScreen({ title }: { title: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 24 }]}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
        <Text style={styles.back}>home</Text>
      </Pressable>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.hint}>coming soon.</Text>
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
  back: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 26,
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
