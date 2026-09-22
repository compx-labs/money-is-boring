import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useStore } from '@tanstack/react-store';
import { ChamferButton } from '@/components/ChamferButton';
import { InferencePick, type InferenceChoice } from '@/components/InferencePick';
import { PaySteps } from '@/components/PaySteps';
import { SheetScaffold, useSheetDismiss } from '@/components/SheetScaffold';
import { useChrome } from '@/hooks/useChrome';
import { useProvider } from '@/hooks/useProvider';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import { startQueuedPay } from '@/lib/agent/pay-job';
import { algorandAddressFromKey, findWalletAccount } from '@/lib/keystore/wallet-account';
import { fonts } from '@/lib/theme';
import { TICKET_POOL_NEED_ALGO, payStepAction } from '@/lib/zerosignal/pay';
import {
  activePayStep,
  agentPayStore,
  cancelQueuedPay,
  confirmSign,
  setPayError,
} from '@/stores/agent-turn';

const SETUP_BODY =
  'To start using agents in your pocket, we need to do a little setup. First, what kind of inference do you want to use?';

function footnote(choice: InferenceChoice | null): string | null {
  if (choice === 'zerosignal') {
    return "You'll need to sign some transactions to start using ZeroSignal.ai, including setting up your escrow.";
  }
  if (choice === 'qvac') {
    return "You'll need to download the default model first ~450mb";
  }
  return null;
}

function AgentPayBody() {
  const dismiss = useSheetDismiss();
  const { bg } = useChrome();
  const pay = useStore(agentPayStore, (state) => state);
  const { keys, accounts } = useProvider();
  const wallet = findWalletAccount(accounts, keys);
  const address = wallet ? algorandAddressFromKey(wallet.key) : '';
  const balances = useWalletBalances(address);
  const algoAmount = balances.holdings.find((h) => h.id === 0)?.amount ?? null;
  const [choice, setChoice] = React.useState<InferenceChoice | null>(null);
  const closed = React.useRef(false);

  const active = activePayStep(pay.steps);
  const consent = pay.phase === 'consent';
  const running = pay.phase === 'running';
  const failed = pay.phase === 'error';
  const setupPick = pay.kind === 'setup' && pay.phase !== 'running' && pay.steps.length === 0;
  const note = setupPick ? footnote(choice) : null;

  React.useEffect(() => {
    if (pay.phase === 'ready') void startQueuedPay();
  }, [pay.phase]);

  React.useEffect(() => {
    if (closed.current) return;
    const stay =
      pay.kind === 'setup'
        ? pay.phase !== 'done' && pay.phase !== 'cancelled'
        : pay.awaitingConfirm || pay.phase === 'consent' || pay.phase === 'ready';
    if (stay) return;
    closed.current = true;
    dismiss();
  }, [dismiss, pay.awaitingConfirm, pay.kind, pay.phase]);

  const onContinue = () => {
    if (setupPick && choice !== 'zerosignal') return;
    if (pay.needsPool && algoAmount != null && algoAmount < TICKET_POOL_NEED_ALGO) {
      setPayError('add ALGO for the ticket pool');
      return;
    }
    void startQueuedPay();
  };

  const buttonLabel = failed
    ? 'try again'
    : running
      ? payStepAction(active?.step ?? 'discover', active?.amountLabel)
      : 'continue';

  const onPress = () => {
    if (pay.awaitingConfirm) {
      confirmSign();
      return;
    }
    if (failed && pay.steps.length > 0) {
      void startQueuedPay();
      return;
    }
    onContinue();
  };

  const disabled = pay.awaitingConfirm
    ? false
    : failed
      ? false
      : running || pay.phase === 'ready'
        ? true
        : setupPick
          ? choice !== 'zerosignal'
          : !consent;

  return (
    <View style={styles.screen}>
      <Text style={[styles.title, { color: bg }]}>
        {pay.kind === 'setup' ? "Let's chat!" : 'agent pay'}
      </Text>
      {setupPick ? (
        <>
          <Text style={[styles.body, { color: bg }]}>{SETUP_BODY}</Text>
          <InferencePick value={choice} onChange={setChoice} />
          {note ? <Text style={[styles.body, { color: bg }]}>{note}</Text> : null}
        </>
      ) : null}
      {pay.steps.length > 0 ? (
        <PaySteps steps={pay.steps} error={pay.error} ink={bg} />
      ) : failed && pay.error ? (
        <Text style={[styles.error, { color: bg }]}>{pay.error}</Text>
      ) : null}
      {pay.warning && !failed ? <Text style={[styles.error, { color: bg }]}>{pay.warning}</Text> : null}
      <ChamferButton
        label={buttonLabel}
        onPress={onPress}
        disabled={disabled}
        accessibilityLabel={buttonLabel}
        style={styles.action}
      />
    </View>
  );
}

export default function AgentPay() {
  return (
    <SheetScaffold
      onDismiss={() => {
        const s = agentPayStore.state;
        if (s.phase === 'consent' || s.phase === 'ready' || s.awaitingConfirm) {
          cancelQueuedPay();
        }
      }}
    >
      <AgentPayBody />
    </SheetScaffold>
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
  body: {
    fontFamily: fonts.regular,
    fontSize: 18,
    lineHeight: 26,
  },
  error: {
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  action: {
    marginTop: 4,
  },
});
