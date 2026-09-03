import type { KeyStoreAPI } from '@algorandfoundation/react-native-keystore';
import { Store } from '@tanstack/react-store';
import type { ChatTurn } from '@/lib/zerosignal/chat';
import {
  reducePayEvent,
  type PayEvent,
  type PayStep,
  type PayStepRow,
} from '@/lib/zerosignal/pay';

export type AgentPayKind = 'setup' | 'turn';

export type AgentPayPhase =
  | 'idle'
  | 'consent'
  | 'ready'
  | 'running'
  | 'error'
  | 'done'
  | 'cancelled';

export type AgentPayState = {
  phase: AgentPayPhase;
  kind: AgentPayKind;
  userId: string;
  assistantId: string;
  draft: string;
  history: ChatTurn[];
  needsPool: boolean;
  steps: PayStepRow[];
  error: string;
  warning: string;
  streamed: string;
  dismissedOnDelta: boolean;
  awaitingConfirm: boolean;
  chargedMicro: number;
  toolsMicro: bigint;
};

export const IDLE_PAY: AgentPayState = {
  phase: 'idle',
  kind: 'turn',
  userId: '',
  assistantId: '',
  draft: '',
  history: [],
  needsPool: false,
  steps: [],
  error: '',
  warning: '',
  streamed: '',
  dismissedOnDelta: false,
  awaitingConfirm: false,
  chargedMicro: 0,
  toolsMicro: 0n,
};

export const agentPayStore = new Store<AgentPayState>({ ...IDLE_PAY });

type Signer = { store: Pick<KeyStoreAPI, 'sign'>; keyId: string; address: string };
let signer: Signer | null = null;
let generation = 0;

export function payGeneration(): number {
  return generation;
}

export function paySigner(): Signer | null {
  return signer;
}

export function queueAgentTurn(input: {
  store: Pick<KeyStoreAPI, 'sign'>;
  keyId: string;
  address: string;
  userId: string;
  assistantId: string;
  draft: string;
  history: ChatTurn[];
  needsPool: boolean;
}): void {
  signer = { store: input.store, keyId: input.keyId, address: input.address };
  generation += 1;
  agentPayStore.setState(() => ({
    ...IDLE_PAY,
    phase: input.needsPool ? 'consent' : 'ready',
    userId: input.userId,
    assistantId: input.assistantId,
    draft: input.draft,
    history: input.history,
    needsPool: input.needsPool,
    kind: 'turn',
  }));
}

export function queueAgentSetup(input: {
  store: Pick<KeyStoreAPI, 'sign'>;
  keyId: string;
  address: string;
}): void {
  signer = { store: input.store, keyId: input.keyId, address: input.address };
  generation += 1;
  agentPayStore.setState(() => ({
    ...IDLE_PAY,
    phase: 'consent',
    kind: 'setup',
    needsPool: true,
  }));
}

export function applyPayEvent(event: PayEvent): void {
  agentPayStore.setState((s) => {
    const next = reducePayEvent(s.steps, event);
    return {
      ...s,
      steps: next.steps,
      error: event.type === 'error' ? (next.error ?? s.error) : event.type === 'step' ? '' : s.error,
      warning: next.warning ?? s.warning,
    };
  });
}

export function setPayRunning(): number {
  generation += 1;
  agentPayStore.setState((s) => ({
    ...s,
    phase: 'running',
    error: '',
    warning: '',
    steps: [],
    streamed: '',
    dismissedOnDelta: false,
    awaitingConfirm: false,
    chargedMicro: 0,
    toolsMicro: 0n,
  }));
  return generation;
}

let deltaFrame: number | null = null;
let pendingDelta: { token: number; text: string } | null = null;

export function notePayDelta(token: number, text: string): void {
  if (token !== generation) return;
  pendingDelta = { token, text };
  if (deltaFrame != null) return;
  deltaFrame = requestAnimationFrame(() => {
    deltaFrame = null;
    const next = pendingDelta;
    pendingDelta = null;
    if (!next || next.token !== generation) return;
    agentPayStore.setState((s) => ({ ...s, streamed: next.text, dismissedOnDelta: true }));
  });
}

function flushPayDelta(token: number): void {
  if (deltaFrame != null) {
    cancelAnimationFrame(deltaFrame);
    deltaFrame = null;
  }
  const next = pendingDelta;
  pendingDelta = null;
  if (!next || next.token !== token || token !== generation) return;
  agentPayStore.setState((s) => ({ ...s, streamed: next.text, dismissedOnDelta: true }));
}

let confirmWait: {
  token: number;
  resolve: () => void;
  reject: (err: Error) => void;
} | null = null;

function rejectConfirm(err: Error): void {
  const wait = confirmWait;
  confirmWait = null;
  wait?.reject(err);
}

/** Pause until the sheet button is pressed. Face ID must not run before this resolves. */
export function requestSignConfirm(token: number): Promise<void> {
  rejectConfirm(new Error('sign cancelled'));
  return new Promise((resolve, reject) => {
    if (token !== generation) {
      reject(new Error('sign cancelled'));
      return;
    }
    confirmWait = { token, resolve, reject };
    agentPayStore.setState((s) => ({ ...s, awaitingConfirm: true }));
  });
}

export function confirmSign(): void {
  const wait = confirmWait;
  if (!wait || wait.token !== generation) return;
  confirmWait = null;
  agentPayStore.setState((s) => ({ ...s, awaitingConfirm: false }));
  wait.resolve();
}

export function finishPay(
  token: number,
  reply: { text: string; chargedMicro: number; toolsMicro: bigint },
): void {
  if (token !== generation) return;
  flushPayDelta(token);
  agentPayStore.setState((s) => ({
    ...s,
    phase: 'done',
    streamed: reply.text,
    awaitingConfirm: false,
    chargedMicro: reply.chargedMicro,
    toolsMicro: reply.toolsMicro,
  }));
}

export function finishSetup(token: number): void {
  if (token !== generation) return;
  agentPayStore.setState((s) => ({ ...s, phase: 'done' }));
}

export function failPay(token: number, message: string, step: PayStep): void {
  if (token !== generation) return;
  flushPayDelta(token);
  applyPayEvent({ type: 'error', step, message });
  agentPayStore.setState((s) => ({ ...s, phase: 'error', error: message, awaitingConfirm: false }));
}

export function setPayError(message: string): void {
  agentPayStore.setState((s) => ({ ...s, phase: 'error', error: message }));
}

/** Consent, ready, error, or waiting on a sign button — user bailed. */
export function cancelQueuedPay(): void {
  const { phase, awaitingConfirm } = agentPayStore.state;
  if (phase === 'done' || phase === 'idle') return;
  if (phase === 'running' && !awaitingConfirm) return;
  const wait = confirmWait;
  confirmWait = null;
  generation += 1;
  wait?.reject(new Error('sign cancelled'));
  agentPayStore.setState((s) => ({
    ...IDLE_PAY,
    phase: 'cancelled',
    userId: s.userId,
    assistantId: s.assistantId,
    draft: s.draft,
  }));
}

export function resetAgentPay(): void {
  rejectConfirm(new Error('sign cancelled'));
  generation += 1;
  signer = null;
  agentPayStore.setState(() => ({ ...IDLE_PAY }));
}

export function activePayStep(steps: PayStepRow[]): PayStepRow | undefined {
  return steps.find((row) => row.state === 'active') ?? steps.find((row) => row.state === 'error');
}
