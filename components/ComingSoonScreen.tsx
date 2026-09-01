import { StyleSheet, Text, View } from 'react-native';
import { HapticPressable } from '@/components/HapticPressable';
import { SheetScaffold, useSheetDismiss } from '@/components/SheetScaffold';
import { useChrome } from '@/hooks/useChrome';
import { fonts } from '@/lib/theme';

export function ComingSoonScreen({ title }: { title: string }) {
  return (
    <SheetScaffold>
      <ComingSoonBody title={title} />
    </SheetScaffold>
  );
}

function ComingSoonBody({ title }: { title: string }) {
  const dismiss = useSheetDismiss();
  const { bg } = useChrome();

  return (
    <View style={styles.screen}>

      <Text style={[styles.title, { color: bg }]}>{title}</Text>
      <Text style={[styles.hint, { color: bg }]}>coming soon.</Text>
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
    fontFamily: fonts.regular,
    fontSize: 26,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 44,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 26,
    lineHeight: 36,
  },
});
