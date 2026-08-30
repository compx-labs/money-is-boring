import React from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HapticPressable } from '@/components/HapticPressable';
import { RollingNumber } from '@/components/RollingNumber';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useProvider } from '@/hooks/useProvider';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import { algorandAddressFromKey, findWalletAccount } from '@/lib/keystore/wallet-account';
import {
  formatAmount,
  fromBaseUnits,
  toBaseUnits,
  type Holding,
} from '@/lib/algorand/balances';
import { executeHaySwap } from '@/lib/hay/execute';
import { quoteHaySwap, type HayQuote } from '@/lib/hay/router';
import { colors, fonts, USDC_ASA_ID } from '@/lib/theme';

const DEBOUNCE_MS = 450;

function formatQuoted(value: number, decimals: number): string {
  if (value === 0) return '0';
  return value.toFixed(decimals).replace(/\.?0+$/, '');
}

function mergeAssets(holdings: Holding[]): Holding[] {
  const byId = new Map<number, Holding>();
  byId.set(0, { id: 0, unit: 'ALGO', amount: 0, decimals: 6 });
  byId.set(USDC_ASA_ID, { id: USDC_ASA_ID, unit: 'USDC', amount: 0, decimals: 6 });
  for (const h of holdings) byId.set(h.id, h);
  return [...byId.values()];
}

export default function Swap() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { keys, accounts, key } = useProvider();
  const wallet = findWalletAccount(accounts, keys);
  const address = wallet ? algorandAddressFromKey(wallet.key) : '';
  const balances = useWalletBalances(address);
  const assets = mergeAssets(balances.holdings);

  const [fromId, setFromId] = React.useState(0);
  const [toId, setToId] = React.useState(USDC_ASA_ID);
  const [amount, setAmount] = React.useState('');
  const [quote, setQuote] = React.useState<HayQuote | null>(null);
  const [quoteError, setQuoteError] = React.useState('');
  const [quoting, setQuoting] = React.useState(false);
  const [busy, setBusy] = React.useState('');

  const fromAsset = assets.find((a) => a.id === fromId) ?? assets[0];
  const toAsset = assets.find((a) => a.id === toId);

  React.useEffect(() => {
    let cancelled = false;
    const base = toBaseUnits(amount, fromAsset?.decimals ?? 6);
    if (!address || fromId === toId || base === '0') {
      setQuote(null);
      setQuoteError('');
      return;
    }
    setQuoting(true);
    const timer = setTimeout(() => {
      quoteHaySwap({ address, fromAssetId: fromId, toAssetId: toId, amount: base })
        .then((next) => {
          if (!cancelled) {
            setQuote(next);
            setQuoteError('');
          }
        })
        .catch((e: unknown) => {
          if (!cancelled) {
            setQuote(null);
            setQuoteError(e instanceof Error ? e.message : 'quote failed');
          }
        })
        .finally(() => {
          if (!cancelled) setQuoting(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [address, amount, fromId, toId, fromAsset?.decimals]);

  if (!wallet || !address) {
    if (keys.length === 0) return <Redirect href="/onboarding" />;
    return <LoadingScreen />;
  }

  const pick = (current: number, other: number, setter: (id: number) => void) => {
    const choices = assets.filter((a) => a.id !== other);
    if (choices.length === 0) return;
    const idx = choices.findIndex((a) => a.id === current);
    setter(choices[(idx + 1) % choices.length].id);
  };

  const invert = () => {
    setFromId(toId);
    setToId(fromId);
    setQuote(null);
  };

  const onSwap = async () => {
    if (!quote || busy) return;
    setBusy('swapping');
    try {
      await executeHaySwap({
        store: key.store,
        keyId: wallet.key.id,
        address,
        quote,
        onStatus: setBusy,
      });
      Alert.alert('Swap submitted', 'Hay routed it. Balances will refresh on home.', [
        { text: 'ok', onPress: () => router.replace('/home') },
      ]);
    } catch (e) {
      Alert.alert('Swap failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy('');
    }
  };

  const outDecimals = toAsset?.decimals ?? 6;
  const outLabel = toAsset?.unit ?? '…';
  const quoteValue = quote ? Number(fromBaseUnits(quote.quotedAmount, outDecimals)) : null;
  const formatQuotedAmount = React.useCallback(
    (n: number) => formatQuoted(n, outDecimals),
    [outDecimals],
  );

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <HapticPressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
          <Text style={styles.back}>home</Text>
        </HapticPressable>

        <Text style={styles.title}>swap</Text>

        <View style={styles.card}>
          <Text style={styles.label}>from</Text>
          <HapticPressable onPress={() => pick(fromId, toId, setFromId)} accessibilityRole="button">
            <Text style={styles.asset}>{fromAsset?.unit ?? 'ALGO'}</Text>
          </HapticPressable>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.line}
            style={styles.amount}
            accessibilityLabel="Swap amount"
          />
          <View style={styles.balanceRow}>
            <RollingNumber value={fromAsset?.amount ?? 0} format={formatAmount} style={styles.balance} />
            <Text style={styles.balance}> {fromAsset?.unit}</Text>
          </View>
        </View>

        <HapticPressable onPress={invert} accessibilityRole="button" accessibilityLabel="Swap direction" style={styles.flip}>
          <Text style={styles.flipLabel}>↕</Text>
        </HapticPressable>

        <View style={styles.card}>
          <Text style={styles.label}>to</Text>
          <HapticPressable onPress={() => pick(toId, fromId, setToId)} accessibilityRole="button">
            <Text style={styles.asset}>{outLabel}</Text>
          </HapticPressable>
          <RollingNumber
            value={quoteValue}
            format={formatQuotedAmount}
            placeholder={quoting ? '…' : '—'}
            style={styles.quoted}
          />
        </View>

        {quote?.userPriceImpact != null ? (
          <Text style={styles.meta}>impact {quote.userPriceImpact.toFixed(2)}%</Text>
        ) : null}
        <Text style={styles.meta}>Hay router · 1% slip</Text>
        {quoteError ? <Text style={styles.error}>{quoteError}</Text> : null}

        <HapticPressable
          onPress={onSwap}
          disabled={!quote || !!busy}
          accessibilityRole="button"
          accessibilityLabel="Confirm swap"
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            (!quote || !!busy) && styles.buttonBusy,
          ]}
        >
          <Text style={styles.buttonLabel}>{busy || 'swap'}</Text>
        </HapticPressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1, backgroundColor: colors.bg },
  screen: {
    flexGrow: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 28,
    gap: 20,
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
  asset: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 32,
  },
  amount: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 40,
    paddingVertical: 4,
  },
  quoted: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 40,
    lineHeight: 48,
    fontVariant: ['tabular-nums'],
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balance: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 26,
    lineHeight: 32,
    fontVariant: ['tabular-nums'],
  },
  flip: {
    alignSelf: 'center',
    padding: 4,
  },
  flipLabel: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 32,
  },
  meta: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 26,
  },
  error: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 26,
  },
  button: {
    backgroundColor: colors.button,
    borderRadius: 8,
    minHeight: 80,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  buttonPressed: { opacity: 0.85 },
  buttonBusy: { opacity: 0.6 },
  buttonLabel: {
    color: colors.buttonText,
    fontFamily: fonts.bold,
    fontSize: 32,
  },
});
