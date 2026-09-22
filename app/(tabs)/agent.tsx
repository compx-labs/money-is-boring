import React from 'react';
import {
  Image,
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
import { CONFIRM_HINT, shouldShowConfirmHint } from '@/lib/agent/confirm';
import { spokenHistory } from '@/lib/agent/history';
import { formatLoadedToolsMessage } from '@/lib/agent/http-tools';
import { startQueuedPay } from '@/lib/agent/pay-job';
import { agentGate } from '@/lib/agent/ready';
import { isSetupDone } from '@/lib/agent/setup';
import type { ChatTurn } from '@/lib/agent/turn';
import { colors, fonts, USDC_ASA_ID } from '@/lib/theme';
import { isEscrowOptedIn } from '@/lib/zerosignal/escrow';
import { isToolStep, payStepAction, payStepLabel } from '@/lib/zerosignal/pay';
import { agentConfirmStore, markConfirmHintShown } from '@/stores/agent-confirm';
import {
  activePayStep,
  agentPayStore,
  confirmSign,
  queueAgentSetup,
  queueAgentTurn,
  resetAgentPay,
} from '@/stores/agent-turn';
import { agentToolsStore } from '@/stores/agent-tools';

const SCREEN_PAD = 28;
const ACTION_HEIGHT = 48;
const ACTION_WIDTH = 120;
const ACTION_HANG = 70;
const SUITE_LOGO = 20;
const SUITE_LIST_ID = 'suite-list';

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

function SuiteStrip({
  name,
  logo,
  count,
  onShowTools,
}: {
  name: string;
  logo: string;
  count: number;
  onShowTools: () => void;
}) {
  const [failed, setFailed] = React.useState(false);
  const letter = (name.trim().charAt(0) || '?').toUpperCase();
  const showImage = Boolean(logo) && !failed;

  React.useEffect(() => {
    setFailed(false);
  }, [logo]);

  return (
    <View style={styles.suiteRow}>
      <View style={styles.suiteLogo} accessibilityIgnoresInvertColors>
        {showImage ? (
          <Image source={{ uri: logo }} style={styles.suiteLogoImage} onError={() => setFailed(true)} />
        ) : (
          <Text style={styles.suiteLetter}>{letter}</Text>
        )}
      </View>
      <Text style={styles.suiteName} numberOfLines={1}>{`${name} - `}</Text>
      <HapticPressable
        onPress={onShowTools}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${count} tools loaded. show list`}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
        style={styles.suiteLinkHit}
      >
        <Text style={styles.suiteLink}>{`${count} tools loaded`}</Text>
      </HapticPressable>
    </View>
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
  const paid = pay.chargedMicro > 0 || pay.toolsMicro > 0n;
  const warning = paid ? pay.warning : '';
  return [zs, tools, warning].filter(Boolean).join(' · ');
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
  const suite = useStore(agentToolsStore, (state) => state);
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
    pay.phase === 'running' &&
    active &&
    active.step !== 'settle' &&
    (!pay.awaitingConfirm || isToolStep(active.step))
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
      const streamed = agentPayStore.state.streamed;
      const showHint = Boolean(streamed.trim()) && shouldShowConfirmHint(agentConfirmStore.state);
      setMessages((prev) => {
        const next = prev.map((m) => (m.id === pay.assistantId ? { ...m, text: streamed } : m));
        if (!showHint) return next;
        return [...next, { id: `hint-${Date.now()}`, role: 'system', text: CONFIRM_HINT }];
      });
      if (showHint) markConfirmHintShown();
      setResult(chargeLine(pay));
      resetAgentPay();
      return;
    }
    if (pay.phase === 'error' && pay.kind === 'turn') {
      const line = pay.error || 'this call failed. try again';
      const assistantId = pay.assistantId;
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, text: line } : m)),
      );
      resetAgentPay();
      return;
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
      const history: ChatTurn[] = spokenHistory([...messages, user]);
      const assistantId = `a-${Date.now()}`;
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

  const onShowTools = () => {
    if (!suite || suite.tools.length === 0) return;
    const text = formatLoadedToolsMessage(suite);
    setMessages((prev) => {
      const rest = prev.filter((m) => m.id !== SUITE_LIST_ID);
      return [...rest, { id: SUITE_LIST_ID, role: 'system', text }];
    });
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
          {messages.map((m) => {
            const isUser = m.role === 'user';
            const isHint = m.role === 'system';
            const copy = (
              <Text
                style={
                  isUser
                    ? [styles.userText, { color: onAccent }]
                    : isHint
                      ? [styles.systemText, { color: ink }]
                      : [styles.assistantText, { color: ink }]
                }
              >
                {m.text || '…'}
              </Text>
            );
            return (
              <SpringInsert key={m.id}>
                {isHint ? (
                  <View style={[styles.system, { borderColor: accent }]}>{copy}</View>
                ) : (
                  <Chamfer
                    fill={isUser ? accent : surface}
                    style={[styles.bubble, isUser ? styles.user : styles.assistant]}
                    contentStyle={styles.bubbleInner}
                  >
                    {copy}
                  </Chamfer>
                )}
              </SpringInsert>
            );
          })}
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
        {suite && suite.tools.length > 0 ? (
          <SuiteStrip
            name={suite.name}
            logo={suite.logo}
            count={suite.tools.length}
            onShowTools={onShowTools}
          />
        ) : null}
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
  system: {
    alignSelf: 'stretch',
    borderWidth: 2,
    borderRadius: 0,
    paddingLeft: 12,
    paddingRight: 12,
    paddingVertical: 12,
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
  systemText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    lineHeight: 18,
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
  suiteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    maxWidth: '100%',
  },
  suiteLogo: {
    width: SUITE_LOGO,
    height: SUITE_LOGO,
    borderRadius: SUITE_LOGO / 2,
    backgroundColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  suiteLogoImage: {
    width: SUITE_LOGO,
    height: SUITE_LOGO,
  },
  suiteLetter: {
    color: colors.buttonText,
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 13,
  },
  suiteName: {
    color: colors.dim,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    lineHeight: 18,
    flexShrink: 1,
  },
  suiteLinkHit: {
    flexShrink: 0,
  },
  suiteLink: {
    color: colors.dim,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    lineHeight: 18,
    textDecorationLine: 'underline',
  },
});
