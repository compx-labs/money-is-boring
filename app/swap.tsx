import React from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { executeHaySwap } from '@/lib/canix/execute';
import { quoteHaySwap, type HayQuote } from '@/lib/canix/hay';
import { colors, fonts, USDC_ASA_ID } from '@/lib/theme';

const DEBOUNCE_MS = 450;

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
  const quotedOut = quote ? fromBaseUnits(quote.quotedAmount, outDecimals) : quoting ? '…' : '—';

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
          <Text style={styles.back}>home</Text>
        </Pressable>

        <Text style={styles.title}>swap</Text>

        <View style={styles.card}>
          <Text style={styles.label}>from</Text>
          <Pressable onPress={() => pick(fromId, toId, setFromId)} accessibilityRole="button">
            <Text style={styles.asset}>{fromAsset?.unit ?? 'ALGO'}</Text>
          </Pressable>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.line}
            style={styles.amount}
            accessibilityLabel="Swap amount"
          />
          <Text style={styles.balance}>
            {formatAmount(fromAsset?.amount ?? 0)} {fromAsset?.unit}
          </Text>
        </View>

        <Pressable onPress={invert} accessibilityRole="button" accessibilityLabel="Swap direction" style={styles.flip}>
          <Text style={styles.flipLabel}>↕</Text>
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.label}>to</Text>
          <Pressable onPress={() => pick(toId, fromId, setToId)} accessibilityRole="button">
            <Text style={styles.asset}>{outLabel}</Text>
          </Pressable>
          <Text style={styles.quoted}>{quotedOut}</Text>
        </View>

        {quote?.userPriceImpact != null ? (
          <Text style={styles.meta}>impact {quote.userPriceImpact.toFixed(2)}%</Text>
        ) : null}
        <Text style={styles.meta}>Hay router · 1% slip · 0.005 USDC cut</Text>
        {quoteError ? <Text style={styles.error}>{quoteError}</Text> : null}

        <Pressable
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
        </Pressable>
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
  },
  balance: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 26,
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
