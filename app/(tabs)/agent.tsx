import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Redirect, useNavigation, useRouter } from 'expo-router';
import { useStore } from '@tanstack/react-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chamfer } from '@/components/Chamfer';
import { ChamferButton } from '@/components/ChamferButton';
import { HapticPressable } from '@/components/HapticPressable';
import { LoadingScreen } from '@/components/LoadingScreen';
import { MorphIcon } from '@/components/MorphIcon';
import { SpringInsert } from '@/components/SpringInsert';
import { useAccent } from '@/hooks/useAccent';
import { useChrome } from '@/hooks/useChrome';
import { useProvider } from '@/hooks/useProvider';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import { algorandAddressFromKey, findWalletAccount } from '@/lib/keystore/wallet-account';
import { fromBaseUnits } from '@/lib/algorand/balances';
import type { ChatTurn } from '@/lib/agent/turn';
import { startQueuedPay } from '@/lib/agent/pay-job';
import { agentGate } from '@/lib/agent/ready';
import { isSetupDone } from '@/lib/agent/setup';
import { prepareLayoutSpring } from '@/lib/motion/layout';
import { fonts, USDC_ASA_ID } from '@/lib/theme';
import { isEscrowOptedIn } from '@/lib/zerosignal/escrow';
import { payStepAction, payStepLabel } from '@/lib/zerosignal/pay';
import {
  activePayStep,
  agentPayStore,
  confirmSign,
  queueAgentSetup,
  queueAgentTurn,
  resetAgentPay,
} from '@/stores/agent-turn';

const SCREEN_PAD = 28;
const ACTION_HEIGHT = 48;
const ACTION_WIDTH = 120;
const ACTION_HANG = 70;

type Bubble = ChatTurn & { id: string };

function SettingsCog({ onPress }: { onPress: () => void }) {
  const { accent, onAccent } = useAccent();
  return (
    <HapticPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Settings"
      style={styles.cogPress}
    >
      <Chamfer fill={accent} style={styles.cogFace} contentStyle={styles.cogContent}>
        <MorphIcon name="settings-outline" size={24} color={onAccent} />
      </Chamfer>
    </HapticPressable>
  );
}

function chargeLine(pay: {
  chargedMicro: number;
  toolsMicro: bigint;
  warning: string;
}): string {
  const zs =
    pay.chargedMicro > 0 ? `ZeroSignal · ${fromBaseUnits(String(pay.chargedMicro), 6)} USDC` : '';
  const tools =
    pay.toolsMicro > 0n ? `tools · ${fromBaseUnits(String(pay.toolsMicro), 6)} USDC` : '';
  return [zs, tools, pay.warning].filter(Boolean).join(' · ');
}

export default function Agent() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { keys, accounts, key } = useProvider();
  const wallet = findWalletAccount(accounts, keys);
  const address = wallet ? algorandAddressFromKey(wallet.key) : '';
  const { accent, surface, onAccent } = useAccent();
  const { tabFill, ink } = useChrome();
  const balances = useWalletBalances(address);
  const pay = useStore(agentPayStore, (state) => state);
  const [starting, setStarting] = React.useState(false);
  const [setupDone, setSetupDone] = React.useState(false);
  const [escrow, setEscrow] = React.useState<boolean | null>(null);
  const [draft, setDraft] = React.useState('');
  const [messages, setMessages] = React.useState<Bubble[]>([]);
  const [result, setResult] = React.useState('');
  const scrollRef = React.useRef<ScrollView>(null);

  const usdc = balances.holdings.find((h) => h.id === USDC_ASA_ID);
  const algo = balances.holdings.find((h) => h.id === 0);
  const usdcAmount = usdc?.amount ?? 0;
  const balancesReady = algo?.amount != null || Boolean(balances.error);
  const gate = agentGate({ setupDone, escrow, balancesReady, usdcAmount });
  const payLocked =
    starting ||
    pay.phase === 'consent' ||
    pay.phase === 'ready' ||
    pay.phase === 'running' ||
    pay.phase === 'error';
  const active = activePayStep(pay.steps);
  const chatBusy =
    pay.phase === 'running' && !pay.awaitingConfirm && active
      ? payStepLabel(active.step, active.amountLabel)
      : '';
  const awaitingSign = pay.kind === 'turn' && pay.awaitingConfirm;
  const signLabel = payStepAction(active?.step ?? 'reserve', active?.amountLabel);

  React.useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, chatBusy]);

  React.useEffect(() => {
    if (!address) return;
    let cancelled = false;
    const verify = () => {
      const done = isSetupDone(address);
      setSetupDone(done);
      balances.refresh();
      if (!done) {
        setEscrow(false);
        return;
      }
      void isEscrowOptedIn(address)
        .then((value) => {
          if (!cancelled) setEscrow(value);
        })
        .catch(() => {
          if (!cancelled) setEscrow((prev) => (prev == null ? false : prev));
        });
    };
    verify();
    const stop = navigation.addListener('focus', verify);
    return () => {
      cancelled = true;
      stop();
    };
  }, [address, navigation, balances.refresh]);

  React.useEffect(() => {
    if (!pay.assistantId || !pay.streamed) return;
    setMessages((prev) => {
      const cur = prev.find((m) => m.id === pay.assistantId);
      if (cur?.text === pay.streamed) return prev;
      return prev.map((m) => (m.id === pay.assistantId ? { ...m, text: pay.streamed } : m));
    });
  }, [pay.assistantId, pay.streamed]);

  React.useEffect(() => {
    if (pay.phase === 'cancelled') {
      prepareLayoutSpring();
      setMessages((prev) => prev.filter((m) => m.id !== pay.userId && m.id !== pay.assistantId));
      setDraft(pay.draft);
      resetAgentPay();
      return;
    }
    if (pay.phase === 'done' && pay.kind === 'setup') {
      setSetupDone(true);
      setEscrow(true);
      resetAgentPay();
      return;
    }
    if (pay.phase === 'done') {
      prepareLayoutSpring();
      const streamed = agentPayStore.state.streamed;
      setMessages((prev) =>
        prev.map((m) => (m.id === pay.assistantId ? { ...m, text: streamed } : m)),
      );
      setResult(chargeLine(pay));
      resetAgentPay();
      return;
    }
    if (pay.phase === 'error' && pay.kind === 'turn') {
      const line = pay.error || 'this call failed. try again';
      console.warn('[agent]', line);
      prepareLayoutSpring();
      setMessages((prev) =>
        prev.map((m) => (m.id === pay.assistantId ? { ...m, text: line } : m)),
      );
      setResult('');
      resetAgentPay();
    }
  }, [pay.phase, pay.kind, pay.assistantId, pay.userId, pay.draft, pay.chargedMicro, pay.toolsMicro, pay.warning, pay.error]);

  if (!wallet || !address) {
    if (keys.length === 0) return <Redirect href="/onboarding" />;
    return <LoadingScreen />;
  }

  const onSend = async () => {
    const text = draft.trim();
    if (!text || payLocked) return;
    if (usdcAmount <= 0) {
      router.push('/add-asset');
      return;
    }
    setStarting(true);
    try {
      let needsPool = false;
      try {
        needsPool = !(await isEscrowOptedIn(address));
      } catch {
        needsPool = false;
      }
      const user: Bubble = { id: `u-${Date.now()}`, role: 'user', text };
      const history: ChatTurn[] = [...messages, user].map(({ role, text: t }) => ({
        role,
        text: t,
      }));
      const assistantId = `a-${Date.now()}`;
      prepareLayoutSpring();
      setDraft('');
      setResult('');
      setMessages((prev) => [...prev, user, { id: assistantId, role: 'assistant', text: '' }]);
      queueAgentTurn({
        store: key.store,
        keyId: wallet.key.id,
        address,
        userId: user.id,
        assistantId,
        draft: text,
        history,
        needsPool,
      });
      if (needsPool) {
        router.push('/agent-pay');
      } else {
        void startQueuedPay();
      }
    } finally {
      setStarting(false);
    }
  };

  const onSetup = () => {
    if (payLocked) return;
    queueAgentSetup({
      store: key.store,
      keyId: wallet.key.id,
      address,
    });
    router.push('/agent-pay');
  };

  const onAddUsdc = () => {
    router.push('/add-asset');
  };

  const onOpenSettings = () => {
    router.push('/agent-settings');
  };

  const screenPad = {
    paddingTop: insets.top + 24,
    paddingBottom: Math.max(insets.bottom, 12),
  };

  if (gate !== 'ready') {
    return (
      <View style={[styles.screen, screenPad]}>
        <View style={[styles.cog, { top: screenPad.paddingTop }]} pointerEvents="box-none">
          <SettingsCog onPress={onOpenSettings} />
        </View>
        <View style={styles.invite}>
          {gate === 'usdc' ? (
            <Text style={[styles.assistantText, { color: ink }]}>
              messages pay in USDC. add some to this wallet.
            </Text>
          ) : null}
        </View>
        {gate === 'setup' ? (
          <ChamferButton
            label="let's chat"
            onPress={onSetup}
            disabled={payLocked}
            accessibilityLabel="Set up agent chat"
          />
        ) : null}
        {gate === 'usdc' ? (
          <ChamferButton label="add USDC" onPress={onAddUsdc} accessibilityLabel="Add USDC" />
        ) : null}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.screen, screenPad]}>
        <View style={[styles.cog, { top: screenPad.paddingTop }]} pointerEvents="box-none">
          <SettingsCog onPress={onOpenSettings} />
        </View>
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
                      : [styles.assistantText, { color: ink }]
                  }
                >
                  {m.text || '…'}
                </Text>
              </Chamfer>
            </SpringInsert>
          ))}
          {chatBusy ? (
            <SpringInsert key="busy">
              <Text style={[styles.meta, { color: ink }]}>{chatBusy}</Text>
            </SpringInsert>
          ) : null}
          {result ? (
            <SpringInsert key="result">
              <Text style={[styles.meta, { color: ink }]}>{result}</Text>
            </SpringInsert>
          ) : null}
        </ScrollView>

        <View style={styles.composer}>
          <Chamfer
            fill={tabFill}
            stroke={accent}
            strokeWidth={2}
            style={styles.inputFace}
            contentStyle={styles.inputInner}
          >
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="message"
              placeholderTextColor={accent}
              editable={!payLocked}
              multiline
              style={[styles.input, { color: ink }]}
              accessibilityLabel="Agent message"
            />
          </Chamfer>
          <ChamferButton
            label={awaitingSign ? signLabel : 'send'}
            onPress={awaitingSign ? confirmSign : onSend}
            disabled={awaitingSign ? false : payLocked || !draft.trim()}
            compact
            overlap
            color={ink}
            accessibilityLabel={awaitingSign ? signLabel : 'send'}
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
    paddingHorizontal: SCREEN_PAD,
    gap: 16,
  },
  cog: {
    position: 'absolute',
    left: -ACTION_HANG,
    zIndex: 2,
  },
  cogPress: {
    width: ACTION_WIDTH,
  },
  cogFace: {
    height: ACTION_HEIGHT,
    width: ACTION_WIDTH,
  },
  cogContent: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 6,
  },
  invite: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 12,
  },
  chat: { flex: 1 },
  chatContent: { gap: 12, paddingTop: ACTION_HEIGHT, paddingBottom: 8 },
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
    fontFamily: fonts.regular,
    fontSize: 22,
    lineHeight: 30,
  },
  meta: {
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
    fontFamily: fonts.regular,
    fontSize: 17,
    padding: 0,
    margin: 0,
  },
});
