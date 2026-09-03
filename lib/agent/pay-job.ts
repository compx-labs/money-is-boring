import { markSetupDone } from '@/lib/agent/setup';
import { sendAgentMessage } from '@/lib/agent/turn';
import { humanPayError } from '@/lib/zerosignal/errors';
import { ensureMbrDeposit } from '@/lib/zerosignal/escrow';
import {
  agentPayStore,
  applyPayEvent,
  failPay,
  finishPay,
  finishSetup,
  notePayDelta,
  payGeneration,
  paySigner,
  requestSignConfirm,
  setPayRunning,
} from '@/stores/agent-turn';

let inflight = false;

async function startQueuedSetup(): Promise<void> {
  const s = paySigner();
  if (!s) return;
  inflight = true;
  const token = setPayRunning();
  try {
    applyPayEvent({ type: 'step', step: 'fundPool' });
    await requestSignConfirm(token);
    await ensureMbrDeposit(s.store, s.keyId, s.address);
    markSetupDone(s.address);
    finishSetup(token);
  } catch (err) {
    console.warn('[agent setup]', err);
    failPay(token, humanPayError(err), 'fundPool');
  } finally {
    inflight = false;
  }
}

/** Runs outside the sheet so dismiss-on-delta does not abort the turn. */
export async function startQueuedPay(): Promise<void> {
  if (inflight) return;
  if (agentPayStore.state.kind === 'setup') {
    await startQueuedSetup();
    return;
  }
  const s = paySigner();
  if (!s) return;
  const history = agentPayStore.state.history;
  inflight = true;
  const token = setPayRunning();
  try {
    const reply = await sendAgentMessage({
      store: s.store,
      keyId: s.keyId,
      address: s.address,
      history,
      onPay: (event) => {
        if (token !== payGeneration()) return;
        applyPayEvent(event);
      },
      awaitSign: () => requestSignConfirm(token),
      onDelta: (text) => notePayDelta(token, text),
    });
    finishPay(token, reply);
  } catch (err) {
    console.warn('[agent pay]', err);
    const active = agentPayStore.state.steps.find((row) => row.state === 'active');
    failPay(token, humanPayError(err), active?.step ?? 'discover');
  } finally {
    inflight = false;
  }
}
