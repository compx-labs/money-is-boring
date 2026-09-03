import { StyleSheet, Text, View } from 'react-native';
import { SheetScaffold } from '@/components/SheetScaffold';
import { useChrome } from '@/hooks/useChrome';
import { fonts } from '@/lib/theme';

function AgentSettingsBody() {
  const { bg } = useChrome();

  return (
    <View style={styles.screen}>
      <Text style={[styles.title, { color: bg }]}>settings</Text>
      <Text style={[styles.hint, { color: bg }]}>this is a settings screen</Text>
    </View>
  );
}

export default function AgentSettings() {
  return (
    <SheetScaffold>
      <AgentSettingsBody />
    </SheetScaffold>
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
