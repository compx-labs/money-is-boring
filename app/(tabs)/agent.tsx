import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useProvider } from '@/hooks/useProvider';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import { algorandAddressFromKey, findWalletAccount } from '@/lib/keystore/wallet-account';
import { formatAmount, fromBaseUnits, fractionDigits } from '@/lib/algorand/balances';
import { pingCanixOpportunities } from '@/lib/canix/client';
import { colors, fonts, USDC_ASA_ID } from '@/lib/theme';

const PING_USDC = 0.01;

export default function Agent() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { keys, accounts, key } = useProvider();
  const wallet = findWalletAccount(accounts, keys);
  const address = wallet ? algorandAddressFromKey(wallet.key) : '';
  const balances = useWalletBalances(address);
  const [busy, setBusy] = React.useState('');
  const [result, setResult] = React.useState('');

  const pot =
    balances.holdings.find((h) => h.id === USDC_ASA_ID) ?? {
      id: USDC_ASA_ID,
      unit: 'USDC',
      amount: 0,
      decimals: 6,
    };
  const potAmount = pot.amount ?? 0;
  const funded = potAmount >= PING_USDC;

  if (!wallet || !address) {
    if (keys.length === 0) return <Redirect href="/onboarding" />;
    return <LoadingScreen />;
  }

  const onPing = async () => {
    if (busy) return;
    if (!funded) {
      Alert.alert('Pot empty', 'Add USDC first. Agent Canix calls pay from this pot.');
      return;
    }
    setBusy('paying Canix');
    setResult('');
    try {
      const ping = await pingCanixOpportunities({
        store: key.store,
        keyId: wallet.key.id,
        address,
      });
      const paid = fromBaseUnits(String(ping.paidMicro), 6);
      setResult(`Canix answered · ${ping.count} opportunities · ${paid} USDC`);
    } catch (e) {
      Alert.alert('Canix call failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy('');
    }
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.screen, { paddingTop: insets.top + 36, paddingBottom: 24 }]}
    >
      <Text style={styles.title}>agent</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Canix pot</Text>
        <Text style={styles.amount}>
          {formatAmount(pot.amount, fractionDigits(pot))} {pot.unit}
        </Text>
      </View>

      <Text style={styles.meta}>
        Agent Canix calls pay per call from this USDC. No key in the app.
      </Text>

      <Pressable
        onPress={() => router.push('/swap')}
        accessibilityRole="button"
        accessibilityLabel="Add USDC"
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        <Text style={styles.buttonLabel}>add USDC</Text>
      </Pressable>

      <Pressable
        onPress={onPing}
        disabled={!!busy}
        accessibilityRole="button"
        accessibilityLabel="Ping Canix"
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          !!busy && styles.buttonBusy,
        ]}
      >
        <Text style={styles.buttonLabel}>{busy || 'ping Canix'}</Text>
      </Pressable>

      {result ? <Text style={styles.meta}>{result}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  screen: {
    flexGrow: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 28,
    gap: 20,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 44,
  },
  card: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 8,
  },
  label: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 26,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  amount: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 40,
    fontVariant: ['tabular-nums'],
  },
  meta: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 26,
    lineHeight: 36,
  },
  button: {
    backgroundColor: colors.button,
    borderRadius: 8,
    minHeight: 80,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: { opacity: 0.85 },
  buttonBusy: { opacity: 0.6 },
  buttonLabel: {
    color: colors.buttonText,
    fontFamily: fonts.bold,
    fontSize: 32,
  },
});
