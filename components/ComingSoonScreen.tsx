import { StyleSheet, Text, View } from 'react-native';
import { HapticPressable } from '@/components/HapticPressable';
import { SheetScaffold, useSheetDismiss } from '@/components/SheetScaffold';
import { colors, fonts } from '@/lib/theme';

export function ComingSoonScreen({ title }: { title: string }) {
  return (
    <SheetScaffold>
      <ComingSoonBody title={title} />
    </SheetScaffold>
  );
}

function ComingSoonBody({ title }: { title: string }) {
  const dismiss = useSheetDismiss();

  return (
    <View style={styles.screen}>
      <HapticPressable onPress={dismiss} accessibilityRole="button" accessibilityLabel="Back">
        <Text style={styles.back}>home</Text>
      </HapticPressable>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.hint}>coming soon.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: 'transparent',
    paddingHorizontal: 28,
    paddingTop: 8,
    paddingBottom: 20,
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
