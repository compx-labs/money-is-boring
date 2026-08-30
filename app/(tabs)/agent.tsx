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
import { formatAmount, fromBaseUnits, fractionDigits } from '@/lib/algorand/balances';
import { pingCanixOpportunities } from '@/lib/canix/client';
import { sendAgentMessage, type ChatTurn } from '@/lib/zerosignal/chat';
import { colors, fonts, USDC_ASA_ID } from '@/lib/theme';

const PING_USDC = 0.01;

type Bubble = ChatTurn & { id: string };

export default function Agent() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { keys, accounts, key } = useProvider();
  const wallet = findWalletAccount(accounts, keys);
  const address = wallet ? algorandAddressFromKey(wallet.key) : '';
  const balances = useWalletBalances(address);
  const [busy, setBusy] = React.useState('');
  const [draft, setDraft] = React.useState('');
  const [messages, setMessages] = React.useState<Bubble[]>([]);
  const [result, setResult] = React.useState('');
  const scrollRef = React.useRef<ScrollView>(null);

  const pot =
    balances.holdings.find((h) => h.id === USDC_ASA_ID) ?? {
      id: USDC_ASA_ID,
      unit: 'USDC',
      amount: 0,
      decimals: 6,
    };
  const potAmount = pot.amount ?? 0;
  const hasUsdc = balances.holdings.some((h) => h.id === USDC_ASA_ID);
  const funded = potAmount >= PING_USDC;

  React.useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, busy]);

  if (!wallet || !address) {
    if (keys.length === 0) return <Redirect href="/onboarding" />;
    return <LoadingScreen />;
  }

  const onSend = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    if (!hasUsdc) {
      Alert.alert('Add USDC', 'ZeroSignal tickets pay from this pot. Add USDC first.');
      return;
    }
    const user: Bubble = { id: `u-${Date.now()}`, role: 'user', text };
    const history: ChatTurn[] = [...messages, user].map(({ role, text: t }) => ({ role, text: t }));
    const assistantId = `a-${Date.now()}`;
    setDraft('');
    setMessages((prev) => [...prev, user, { id: assistantId, role: 'assistant', text: '' }]);
    setBusy('finding a node');
    try {
      const reply = await sendAgentMessage({
        store: key.store,
        keyId: wallet.key.id,
        address,
        history,
        onStatus: setBusy,
        onDelta: (delta) => {
          setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, text: delta } : m)));
        },
      });
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, text: reply.text } : m)));
      if (reply.chargedMicro > 0) {
        setResult(`ZeroSignal · ${fromBaseUnits(String(reply.chargedMicro), 6)} USDC`);
      } else {
        setResult('');
      }
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== assistantId && m.id !== user.id));
      setDraft(text);
      Alert.alert('Agent failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy('');
    }
  };

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
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Text style={styles.title}>agent</Text>

        <View style={styles.potRow}>
          <View style={styles.pot}>
            <Text style={styles.label}>Canix pot</Text>
            <Text style={styles.amount}>
              {formatAmount(pot.amount, fractionDigits(pot))} {pot.unit}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/swap')}
            accessibilityRole="button"
            accessibilityLabel="Add USDC"
            style={({ pressed }) => [styles.add, pressed && styles.buttonPressed]}
          >
            <Text style={styles.addLabel}>add USDC</Text>
          </Pressable>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.chat}
          contentContainerStyle={styles.chatContent}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 ? (
            <Text style={styles.meta}>
              In-wallet chat. Inference is ZeroSignal, pay per call from this device. No local daemon.
            </Text>
          ) : null}
          {messages.map((m) =>
            m.text || m.role === 'user' ? (
              <View key={m.id} style={[styles.bubble, m.role === 'user' ? styles.user : styles.assistant]}>
                <Text style={m.role === 'user' ? styles.userText : styles.assistantText}>{m.text || '…'}</Text>
              </View>
            ) : null,
          )}
          {busy ? <Text style={styles.meta}>{busy}</Text> : null}
          {result ? <Text style={styles.meta}>{result}</Text> : null}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="message"
            placeholderTextColor={colors.muted}
            editable={!busy}
            multiline
            style={styles.input}
            accessibilityLabel="Agent message"
          />
          <Pressable
            onPress={onSend}
            disabled={!!busy || !draft.trim()}
            accessibilityRole="button"
            accessibilityLabel="Send"
            style={({ pressed }) => [
              styles.send,
              pressed && styles.buttonPressed,
              (!!busy || !draft.trim()) && styles.buttonBusy,
            ]}
          >
            <Text style={styles.sendLabel}>send</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={onPing}
          disabled={!!busy}
          accessibilityRole="button"
          accessibilityLabel="Ping Canix"
          style={({ pressed }) => [styles.ping, pressed && styles.buttonPressed, !!busy && styles.buttonBusy]}
        >
          <Text style={styles.pingLabel}>{busy === 'paying Canix' ? busy : 'ping Canix'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 28,
    gap: 16,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 44,
  },
  potRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  pot: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  label: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 16,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  amount: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 28,
    fontVariant: ['tabular-nums'],
  },
  add: {
    backgroundColor: colors.button,
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  addLabel: {
    color: colors.buttonText,
    fontFamily: fonts.bold,
    fontSize: 22,
  },
  chat: { flex: 1 },
  chatContent: { gap: 12, paddingBottom: 8 },
  bubble: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: '92%',
  },
  user: {
    alignSelf: 'flex-end',
    backgroundColor: colors.button,
  },
  assistant: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
  },
  userText: {
    color: colors.buttonText,
    fontFamily: fonts.regular,
    fontSize: 22,
    lineHeight: 30,
  },
  assistantText: {
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 22,
    lineHeight: 30,
  },
  meta: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 22,
    lineHeight: 30,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 56,
    maxHeight: 140,
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 22,
  },
  send: {
    backgroundColor: colors.button,
    borderRadius: 8,
    minHeight: 56,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  sendLabel: {
    color: colors.buttonText,
    fontFamily: fonts.bold,
    fontSize: 24,
  },
  ping: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  pingLabel: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 20,
  },
  buttonPressed: { opacity: 0.85 },
  buttonBusy: { opacity: 0.6 },
});
