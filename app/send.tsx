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
import { Redirect } from 'expo-router';
import { AssetIcon } from '@/components/AssetIcon';
import { Chamfer } from '@/components/Chamfer';
import { ChamferButton } from '@/components/ChamferButton';
import { LoadingScreen } from '@/components/LoadingScreen';
import { SheetScaffold } from '@/components/SheetScaffold';
import { useAccent } from '@/hooks/useAccent';
import { useAsaIcons } from '@/hooks/useAsaIcons';
import { useChrome } from '@/hooks/useChrome';
import { useProvider } from '@/hooks/useProvider';
import { isAlgorandAddress } from '@/lib/algorand/address';
import { toBaseUnits } from '@/lib/algorand/balances';
import { signAndSubmitPayment } from '@/lib/algorand/submit';
import { isAuthCanceled } from '@/lib/keystore/auth-options';
import { algorandAddressFromKey, findWalletAccount } from '@/lib/keystore/wallet-account';
import { fonts } from '@/lib/theme';

const AMOUNT_ACCESSORY_ID = 'send-amount-done';
type Phase = 'form' | 'processing' | 'success' | 'error';

export default function Send() {
  const { keys, accounts, key } = useProvider();
  const wallet = findWalletAccount(accounts, keys);
  const address = wallet ? algorandAddressFromKey(wallet.key) : '';
  const { accent } = useAccent();
  const { bg } = useChrome();
  const icons = useAsaIcons();

  const [amount, setAmount] = React.useState('');
  const [to, setTo] = React.useState('');
  const [phase, setPhase] = React.useState<Phase>('form');
  const [error, setError] = React.useState('');
  const [amountFocused, setAmountFocused] = React.useState(false);
  const sending = React.useRef(false);

  if (!wallet || !address) {
    if (keys.length === 0) return <Redirect href="/onboarding" />;
    return <LoadingScreen />;
  }

  const amountMicro = /^\d*\.?\d*$/.test(amount.trim()) ? BigInt(toBaseUnits(amount, 6)) : 0n;
  const canSend = isAlgorandAddress(to) && amountMicro > 0n;

  const onSend = async () => {
    if (sending.current || !canSend) return;
    sending.current = true;
    Keyboard.dismiss();
    setPhase('processing');
    try {
      await signAndSubmitPayment(key.store, wallet.key.id, address, to.trim(), amountMicro);
      setPhase('success');
    } catch (e: unknown) {
      sending.current = false;
      if (isAuthCanceled(e)) {
        setPhase('form');
        return;
      }
      setError(e instanceof Error ? e.message : 'send failed');
      setPhase('error');
    }
  };

  const statusCopy =
    phase === 'processing' ? 'processing' : phase === 'success' ? 'success' : error;

  return (
    <>
      <SheetScaffold dismissible={phase !== 'processing'}>
        <Pressable style={styles.screen} onPress={Keyboard.dismiss} accessible={false}>
          <Text style={[styles.title, { color: bg }]}>send</Text>
          {phase === 'form' ? (
            <>
              <Chamfer
                fill="none"
                stroke={bg}
                strokeWidth={2}
                style={styles.card}
                contentStyle={styles.tokenRow}
              >
                <View style={styles.token}>
                  <AssetIcon unit="ALGO" uri={icons.get(0)} />
                  <Text style={[styles.tokenName, { color: bg }]}>ALGO</Text>
                </View>
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
                  accessibilityLabel="Send amount"
                />
              </Chamfer>
              <Chamfer
                fill="none"
                stroke={bg}
                strokeWidth={2}
                style={styles.card}
                contentStyle={styles.addressInner}
              >
                <TextInput
                  value={to}
                  onChangeText={setTo}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  spellCheck={false}
                  returnKeyType="done"
                  enterKeyHint="done"
                  blurOnSubmit
                  onSubmitEditing={Keyboard.dismiss}
                  placeholder="address"
                  placeholderTextColor={bg}
                  style={[styles.address, { color: bg }]}
                  accessibilityLabel="Recipient address"
                />
              </Chamfer>
              <ChamferButton
                label="send"
                onPress={() => void onSend()}
                disabled={!canSend}
                accessibilityLabel="Send"
                style={styles.action}
              />
            </>
          ) : (
            <Text style={[styles.status, { color: bg }]}>{statusCopy}</Text>
          )}
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
  title: {
    fontFamily: fonts.semibold,
    fontSize: 32,
  },
  card: {
    alignSelf: 'stretch',
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 12,
    paddingVertical: 12,
    gap: 12,
    minHeight: 48,
  },
  token: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  tokenName: {
    fontFamily: fonts.semibold,
    fontSize: 20,
  },
  amount: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 32,
    lineHeight: 36,
    padding: 0,
    textAlign: 'right',
  },
  addressInner: {
    paddingLeft: 12,
    paddingRight: 12,
    paddingVertical: 12,
  },
  address: {
    fontFamily: fonts.regular,
    fontSize: 18,
    lineHeight: 24,
    padding: 0,
  },
  action: {
    marginTop: 4,
  },
  status: {
    fontFamily: fonts.regular,
    fontSize: 26,
    lineHeight: 36,
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
