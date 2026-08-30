import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SittingCube } from '@/components/SittingCube';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useProvider } from '@/hooks/useProvider';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import { algorandAddressFromKey, findWalletAccount } from '@/lib/keystore/wallet-account';
import { formatAmount, fractionDigits, truncateAddress } from '@/lib/algorand/balances';
import { colors, fonts } from '@/lib/theme';
import { Redirect, useRouter } from 'expo-router';

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { keys, accounts } = useProvider();
  const wallet = findWalletAccount(accounts, keys);
  const address = wallet ? algorandAddressFromKey(wallet.key) : '';
  const [copied, setCopied] = React.useState(false);
  const balances = useWalletBalances(address);

  if (!wallet || !address) {
    if (keys.length === 0) return <Redirect href="/onboarding" />;
    return <LoadingScreen />;
  }

  const onCopy = async () => {
    await Clipboard.setStringAsync(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.screen, { paddingTop: insets.top + 36, paddingBottom: insets.bottom + 24 }]}
    >
      <SittingCube size={140} />

      <Pressable onPress={onCopy} accessibilityRole="button" accessibilityLabel="Copy address">
        <Text style={styles.address}>{copied ? 'copied' : truncateAddress(address)}</Text>
      </Pressable>

      <View style={styles.balances}>
        {balances.holdings.map((holding, i) => (
          <React.Fragment key={holding.id}>
            {i > 0 ? <View style={styles.rule} /> : null}
            <Row label={holding.unit} value={formatAmount(holding.amount, fractionDigits(holding))} />
          </React.Fragment>
        ))}
      </View>

      {balances.error ? <Text style={styles.error}>couldn’t load balances</Text> : null}

      <Pressable
        onPress={() => router.push('/swap')}
        accessibilityRole="button"
        accessibilityLabel="Swap"
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        <Text style={styles.buttonLabel}>swap</Text>
      </Pressable>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  screen: {
    flexGrow: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    paddingHorizontal: 28,
    gap: 28,
  },
  address: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 30,
    letterSpacing: 1.2,
    fontVariant: ['tabular-nums'],
  },
  balances: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 24,
  },
  rowLabel: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 28,
    letterSpacing: 2,
  },
  rowValue: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 40,
    fontVariant: ['tabular-nums'],
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
  },
  error: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 26,
  },
  button: {
    alignSelf: 'stretch',
    backgroundColor: colors.button,
    borderRadius: 8,
    minHeight: 80,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: { opacity: 0.85 },
  buttonLabel: {
    color: colors.buttonText,
    fontFamily: fonts.bold,
    fontSize: 32,
  },
});
