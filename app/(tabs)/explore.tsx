import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chamfer } from '@/components/Chamfer';
import { MerchantRow } from '@/components/MerchantRow';
import { SpringInsert } from '@/components/SpringInsert';
import { useAccent } from '@/hooks/useAccent';
import { useX402Merchants } from '@/hooks/useX402Merchants';
import { colors, fonts } from '@/lib/theme';

function TopicPill({ label }: { label: string }) {
  const { accent, onAccent } = useAccent();
  return (
    <Chamfer fill={accent} style={styles.pill} contentStyle={styles.pillInner}>
      <Text style={[styles.pillLabel, { color: onAccent }]}>{label}</Text>
    </Chamfer>
  );
}

export default function Explore() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { merchants, loading, error } = useX402Merchants();
  const { accent } = useAccent();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.screen,
        { paddingTop: insets.top + 36, paddingBottom: Math.max(insets.bottom, 12) + 72 },
      ]}
    >
      <Text style={[styles.title, { color: accent }]}>Explore</Text>
      <TopicPill label="x402" />
      {loading ? (
        <Text style={styles.meta}>loading</Text>
      ) : error ? (
        <Text style={styles.meta}>couldn’t load merchants</Text>
      ) : merchants.length === 0 ? (
        <Text style={styles.meta}>nothing listed yet.</Text>
      ) : (
        <View style={styles.list}>
          {merchants.map((merchant) => (
            <SpringInsert key={merchant.id}>
              <MerchantRow
                merchant={merchant}
                onPress={() => router.push(`/merchant/${merchant.id}`)}
              />
            </SpringInsert>
          ))}
        </View>
      )}
      <TopicPill label="MCP" />
      <TopicPill label="Skills" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  screen: {
    flexGrow: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: 28,
    gap: 16,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 44,
  },
  pill: {
    alignSelf: 'flex-start',
  },
  pillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  pillLabel: {
    fontFamily: fonts.semibold,
    fontSize: 18,
  },
  list: {
    alignSelf: 'stretch',
    gap: 10,
  },
  meta: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 26,
    lineHeight: 36,
  },
});
