import React from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { HapticPressable } from '@/components/HapticPressable';
import { Chamfer } from '@/components/Chamfer';
import { ChamferButton } from '@/components/ChamferButton';
import { MorphIcon } from '@/components/MorphIcon';
import { RollingNumber } from '@/components/RollingNumber';
import { LoadingScreen } from '@/components/LoadingScreen';
import { SheetScaffold, useSheetDismiss } from '@/components/SheetScaffold';
import { useAccent } from '@/hooks/useAccent';
import { useChrome } from '@/hooks/useChrome';
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
import { fonts, USDC_ASA_ID } from '@/lib/theme';

const DEBOUNCE_MS = 450;
const AMOUNT_ACCESSORY_ID = 'swap-amount-done';

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
  const { keys, accounts, key } = useProvider();
  const wallet = findWalletAccount(accounts, keys);
  const address = wallet ? algorandAddressFromKey(wallet.key) : '';
  const { accent } = useAccent();
  const { bg } = useChrome();
  const balances = useWalletBalances(address);
  const assets = mergeAssets(balances.holdings);

  const [fromId, setFromId] = React.useState(0);
  const [toId, setToId] = React.useState(USDC_ASA_ID);
  const [amount, setAmount] = React.useState('');
  const [quote, setQuote] = React.useState<HayQuote | null>(null);
  const [quoteError, setQuoteError] = React.useState('');
  const [quoting, setQuoting] = React.useState(false);
  const [busy, setBusy] = React.useState('');
  const [amountFocused, setAmountFocused] = React.useState(false);

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
    Keyboard.dismiss();
    setBusy('swapping');
    try {
      await executeHaySwap({
        store: key.store,
        keyId: wallet.key.id,
        address,
        quote,
        onStatus: setBusy,
      });
      router.replace('/home');
    } catch (e) {
      setQuoteError(e instanceof Error ? e.message : 'swap failed');
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
    <>
      <SheetScaffold>
        <Pressable style={styles.screen} onPress={Keyboard.dismiss} accessible={false}>

          <Text style={[styles.title, { color: bg }]}>swap</Text>

          <Chamfer
            fill="none"
            stroke={bg}
            strokeWidth={2}
            style={styles.card}
            contentStyle={styles.cardInner}
          >
            <Text style={[styles.label, { color: bg }]}>from</Text>
            <HapticPressable onPress={() => pick(fromId, toId, setFromId)} accessibilityRole="button">
              <Text style={[styles.asset, { color: bg }]}>{fromAsset?.unit ?? 'ALGO'}</Text>
            </HapticPressable>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              returnKeyType="done"
              enterKeyHint="done"
              blurOnSubmit
              inputAccessoryViewID={Platform.OS === 'ios' ? AMOUNT_ACCESSORY_ID : undefined}
              onFocus={() => setAmountFocused(true)}
              onBlur={() => setAmountFocused(false)}
              onSubmitEditing={Keyboard.dismiss}
              placeholder="0"
              placeholderTextColor={bg}
              style={[styles.amount, { color: bg }]}
              accessibilityLabel="Swap amount"
            />
            <View style={styles.balanceRow}>
              <RollingNumber value={fromAsset?.amount ?? 0} format={formatAmount} style={[styles.balance, { color: bg }]} />
              <Text style={[styles.balance, { color: bg }]}> {fromAsset?.unit}</Text>
            </View>
          </Chamfer>

          <HapticPressable onPress={invert} accessibilityRole="button" accessibilityLabel="Swap direction" style={styles.flip}>
            <Chamfer fill={bg} contentInset={false} style={styles.flipFace} contentStyle={styles.flipInner}>
              <MorphIcon name="swap-vertical" size={20} color={accent} />
            </Chamfer>
          </HapticPressable>

          <Chamfer
            fill="none"
            stroke={bg}
            strokeWidth={2}
            style={styles.card}
            contentStyle={styles.cardInner}
          >
            <Text style={[styles.label, { color: bg }]}>to</Text>
            <HapticPressable onPress={() => pick(toId, fromId, setToId)} accessibilityRole="button">
              <Text style={[styles.asset, { color: bg }]}>{outLabel}</Text>
            </HapticPressable>
            <RollingNumber
              value={quoteValue}
              format={formatQuotedAmount}
              placeholder={quoting ? '…' : '—'}
              style={[styles.quoted, { color: bg }]}
            />
          </Chamfer>

          {quote?.userPriceImpact != null ? (
            <Text style={[styles.meta, { color: bg }]}>impact {quote.userPriceImpact.toFixed(2)}%</Text>
          ) : null}
          <Text style={[styles.meta, { color: bg }]}>1% slippage</Text>
          {quoteError ? <Text style={[styles.error, { color: bg }]}>{quoteError}</Text> : null}

          <ChamferButton
            label={busy || 'swap'}
            onPress={onSwap}
            disabled={!quote || !!busy}
            accessibilityLabel="Confirm swap"
            style={styles.swapAction}
          />
        </Pressable>
      </SheetScaffold>
      {Platform.OS === 'ios' && amountFocused ? (
        <InputAccessoryView nativeID={AMOUNT_ACCESSORY_ID} backgroundColor={accent}>
          <View style={styles.accessory}>
            <Pressable
              onPress={Keyboard.dismiss}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Dismiss keyboard"
            >
              <Text style={[styles.accessoryDone, { color: bg }]}>done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: 'transparent',
    paddingHorizontal: 28,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 12,
  },
  back: {
    fontFamily: fonts.regular,
    fontSize: 18,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 32,
  },
  card: {
    alignSelf: 'stretch',
  },
  cardInner: {
    paddingLeft: 12,
    paddingRight: 12,
    paddingVertical: 12,
    gap: 4,
  },
  label: {
    fontFamily: fonts.regular,
    fontSize: 13,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  asset: {
    fontFamily: fonts.semibold,
    fontSize: 20,
  },
  amount: {
    fontFamily: fonts.semibold,
    fontSize: 32,
    lineHeight: 36,
    padding: 0,
  },
  quoted: {
    fontFamily: fonts.semibold,
    fontSize: 32,
    lineHeight: 36,
    fontVariant: ['tabular-nums'],
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balance: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
  flip: {
    alignSelf: 'center',
    zIndex: 2,
    marginVertical: -20,
  },
  flipFace: {
    width: 40,
    height: 40,
  },
  flipInner: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  error: {
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  swapAction: {
    marginTop: 4,
  },
  accessory: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  accessoryDone: {
    fontFamily: fonts.semibold,
    fontSize: 17,
  },
});
