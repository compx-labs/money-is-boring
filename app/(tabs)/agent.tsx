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
import { Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chamfer } from '@/components/Chamfer';
import { ChamferButton } from '@/components/ChamferButton';
import { LoadingScreen } from '@/components/LoadingScreen';
import { SpringInsert } from '@/components/SpringInsert';
import { useAccent } from '@/hooks/useAccent';
import { useProvider } from '@/hooks/useProvider';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import { algorandAddressFromKey, findWalletAccount } from '@/lib/keystore/wallet-account';
import { fromBaseUnits } from '@/lib/algorand/balances';
import { sendAgentMessage, type ChatTurn } from '@/lib/zerosignal/chat';
import { prepareLayoutSpring } from '@/lib/motion/layout';
import { colors, fonts, USDC_ASA_ID } from '@/lib/theme';

type Bubble = ChatTurn & { id: string };

export default function Agent() {
  const insets = useSafeAreaInsets();
  const { keys, accounts, key } = useProvider();
  const wallet = findWalletAccount(accounts, keys);
  const address = wallet ? algorandAddressFromKey(wallet.key) : '';
  const { accent, surface, onAccent } = useAccent();
  const balances = useWalletBalances(address);
  const [busy, setBusy] = React.useState('');
  const [draft, setDraft] = React.useState('');
  const [messages, setMessages] = React.useState<Bubble[]>([]);
  const [result, setResult] = React.useState('');
  const scrollRef = React.useRef<ScrollView>(null);

  const usdc = balances.holdings.find((h) => h.id === USDC_ASA_ID);
  const usdcAmount = usdc?.amount ?? 0;

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
    if (usdcAmount <= 0) {
      Alert.alert('Add USDC', 'Agent messages pay in USDC from this wallet. Add some first.');
      return;
    }
    const user: Bubble = { id: `u-${Date.now()}`, role: 'user', text };
    const history: ChatTurn[] = [...messages, user].map(({ role, text: t }) => ({ role, text: t }));
    const assistantId = `a-${Date.now()}`;
    prepareLayoutSpring();
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
      prepareLayoutSpring();
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, text: reply.text } : m)));
      const zs = reply.chargedMicro > 0 ? `ZeroSignal · ${fromBaseUnits(String(reply.chargedMicro), 6)} USDC` : '';
      const tools =
        reply.toolsMicro > 0n ? `tools · ${fromBaseUnits(String(reply.toolsMicro), 6)} USDC` : '';
      setResult([zs, tools].filter(Boolean).join(' · '));
    } catch (e) {
      prepareLayoutSpring();
      setMessages((prev) => prev.filter((m) => m.id !== assistantId && m.id !== user.id));
      setDraft(text);
      Alert.alert('Agent failed', e instanceof Error ? e.message : 'Unknown error');
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
        <ScrollView
          ref={scrollRef}
          style={styles.chat}
          contentContainerStyle={styles.chatContent}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((m) => (
            <SpringInsert key={m.id}>
              <Chamfer
                fill={m.role === 'user' ? accent : surface}
                style={[styles.bubble, m.role === 'user' ? styles.user : styles.assistant]}
                contentStyle={styles.bubbleInner}
              >
                <Text
                  style={
                    m.role === 'user'
                      ? [styles.userText, { color: onAccent }]
                      : styles.assistantText
                  }
                >
                  {m.text || '…'}
                </Text>
              </Chamfer>
            </SpringInsert>
          ))}
          {busy ? (
            <SpringInsert key="busy">
              <Text style={styles.meta}>{busy}</Text>
            </SpringInsert>
          ) : null}
          {result ? (
            <SpringInsert key="result">
              <Text style={styles.meta}>{result}</Text>
            </SpringInsert>
          ) : null}
        </ScrollView>

        <View style={styles.composer}>
          <Chamfer fill={surface} style={styles.inputFace} contentStyle={styles.inputInner}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="message"
              placeholderTextColor={colors.button}
              editable={!busy}
              multiline
              style={styles.input}
              accessibilityLabel="Agent message"
            />
          </Chamfer>
          <ChamferButton
            label="send"
            onPress={onSend}
            disabled={!!busy || !draft.trim()}
            compact
            overlap
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: 'transparent' },
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: 28,
    gap: 16,
  },
  chat: { flex: 1 },
  chatContent: { gap: 12, paddingBottom: 8 },
  bubble: {
    maxWidth: '92%',
  },
  bubbleInner: {
    paddingLeft: 12,
    paddingRight: 12,
    paddingVertical: 12,
  },
  user: {
    alignSelf: 'flex-end',
  },
  assistant: {
    alignSelf: 'flex-start',
  },
  userText: {
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
  },
  inputFace: {
    flex: 1,
  },
  inputInner: {
    minHeight: 48,
    maxHeight: 105,
    paddingLeft: 12,
    paddingRight: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  input: {
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 17,
    padding: 0,
    margin: 0,
  },
});
