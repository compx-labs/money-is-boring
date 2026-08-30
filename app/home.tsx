import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SittingCube } from '@/components/SittingCube';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useProvider } from '@/hooks/useProvider';
import { algorandAddressFromKey, findWalletAccount } from '@/lib/keystore/wallet-account';
import { fetchBalances, formatAmount, truncateAddress, type Balances } from '@/lib/algorand/balances';
import { colors, fonts } from '@/lib/theme';
import { Redirect } from 'expo-router';

export default function Home() {
  const insets = useSafeAreaInsets();
  const { keys, accounts } = useProvider();
  const wallet = findWalletAccount(accounts, keys);
  const address = wallet ? algorandAddressFromKey(wallet.key) : '';
  const [copied, setCopied] = React.useState(false);
  const [balances, setBalances] = React.useState<Balances>({ algo: null, usdc: null });

  React.useEffect(() => {
    if (!address) return;
    let cancelled = false;
    fetchBalances(address).then((next) => {
      if (!cancelled) setBalances(next);
    });
    return () => {
      cancelled = true;
    };
  }, [address]);

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
    <View style={[styles.screen, { paddingTop: insets.top + 36, paddingBottom: insets.bottom + 24 }]}>
      <SittingCube size={140} />

      <Pressable onPress={onCopy} accessibilityRole="button" accessibilityLabel="Copy address">
        <Text style={styles.address}>{copied ? 'copied' : truncateAddress(address)}</Text>
      </Pressable>

      <View style={styles.balances}>
        <Row label="ALGO" value={formatAmount(balances.algo)} />
        <View style={styles.rule} />
        <Row label="USDC" value={formatAmount(balances.usdc, 2)} />
      </View>

      {balances.error ? <Text style={styles.error}>couldn’t load balances</Text> : null}
    </View>
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
  screen: {
    flex: 1,
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
});
