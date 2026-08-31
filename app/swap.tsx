import React from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { HapticPressable } from '@/components/HapticPressable';
import { Chamfer } from '@/components/Chamfer';
import { ChamferButton } from '@/components/ChamferButton';
import { RollingNumber } from '@/components/RollingNumber';
import { LoadingScreen } from '@/components/LoadingScreen';
import { SheetScaffold, useSheetDismiss } from '@/components/SheetScaffold';
import { useAccent } from '@/hooks/useAccent';
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

function SwapHomeBack() {
  const dismiss = useSheetDismiss();
  return (
    <HapticPressable onPress={dismiss} accessibilityRole="button" accessibilityLabel="Back">
      <Text style={styles.back}>home</Text>
    </HapticPressable>
  );
}

export default function Swap() {
  const router = useRouter();
  const { keys, accounts, key } = useProvider();
  const wallet = findWalletAccount(accounts, keys);
  const address = wallet ? algorandAddressFromKey(wallet.key) : '';
  const { accent, surface, onAccent } = useAccent();
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
    <SheetScaffold>
      <View style={styles.screen}>
        <SwapHomeBack />

        <Text style={styles.title}>swap</Text>

        <Chamfer fill={surface} style={styles.card} contentStyle={styles.cardInner}>
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
        </Chamfer>

        <HapticPressable onPress={invert} accessibilityRole="button" accessibilityLabel="Swap direction" style={styles.flip}>
          <Chamfer fill={accent} contentInset={false} style={styles.flipFace} contentStyle={styles.flipInner}>
            <Text style={[styles.flipLabel, { color: onAccent }]}>↕</Text>
          </Chamfer>
        </HapticPressable>

        <Chamfer fill={surface} style={styles.card} contentStyle={styles.cardInner}>
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
        </Chamfer>

        {quote?.userPriceImpact != null ? (
          <Text style={styles.meta}>impact {quote.userPriceImpact.toFixed(2)}%</Text>
        ) : null}
        <Text style={styles.meta}>Hay router · 1% slip</Text>
        {quoteError ? <Text style={styles.error}>{quoteError}</Text> : null}

        <ChamferButton
          label={busy || 'swap'}
          onPress={onSwap}
          disabled={!quote || !!busy}
          accessibilityLabel="Confirm swap"
          style={styles.swapAction}
        />
      </View>
    </SheetScaffold>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: 'transparent',
    paddingHorizontal: 28,
    paddingTop: 8,
    paddingBottom: 24,
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
  },
  cardInner: {
    paddingLeft: 16,
    paddingRight: 16,
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
    padding: 0,
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
  },
  flipFace: {
    width: 48,
    height: 48,
  },
  flipInner: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flipLabel: {
    fontFamily: fonts.bold,
    fontSize: 24,
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
  swapAction: {
    marginTop: 12,
  },
});
