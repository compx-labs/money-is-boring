export const TICKET_POOL_ALGO = 0.5;
/** 0.5 ALGO pool plus a little for fees. */
export const TICKET_POOL_NEED_ALGO = 0.51;

export type PayStep =
  | 'discover'
  | 'reserve'
  | 'fundPool'
  | 'openEscrow'
  | 'think'
  | 'settle'
  | `tool:${string}`;

export type PayEvent =
  | { type: 'step'; step: PayStep; amountLabel?: string }
  | { type: 'error'; step: PayStep; message: string }
  | { type: 'warning'; step: PayStep; message: string };

export type PayListener = (event: PayEvent) => void;

export function isToolStep(step: PayStep): step is `tool:${string}` {
  return step.startsWith('tool:');
}

export type StepState = 'pending' | 'active' | 'done' | 'error';

export type PayStepRow = {
  step: PayStep;
  state: StepState;
  amountLabel?: string;
};

export function reducePayEvent(
  steps: PayStepRow[],
  event: PayEvent,
): { steps: PayStepRow[]; error?: string; warning?: string } {
  if (event.type === 'warning') {
    return { steps, warning: event.message };
  }
  if (event.type === 'error') {
    let found = false;
    const marked = steps.map((row) => {
      if (!found && row.step === event.step && row.state === 'active') {
        found = true;
        return { ...row, state: 'error' as const };
      }
      return row;
    });
    if (found) return { steps: marked, error: event.message };
    const next = marked.map((row) =>
      row.state === 'active' ? { ...row, state: 'done' as const } : row,
    );
    next.push({ step: event.step, state: 'error' });
    return { steps: next, error: event.message };
  }
  const next = steps.map((row) =>
    row.state === 'active' ? { ...row, state: 'done' as const } : row,
  );
  next.push({ step: event.step, state: 'active', amountLabel: event.amountLabel });
  return { steps: next };
}

/** In-app confirm + Face ID. Only when money moves. */
export function isSignStep(step: PayStep): boolean {
  return step === 'fundPool' || step === 'openEscrow';
}

/** Ticket max_price is microUSDC. Zero is a free call — no lock button. */
export function ticketLocksUsdc(maxPriceMicro: unknown): boolean {
  const n = typeof maxPriceMicro === 'bigint' ? Number(maxPriceMicro) : Number(maxPriceMicro);
  return Number.isFinite(n) && n > 0;
}

export function payStepLabel(step: PayStep, amountLabel?: string): string {
  if (isToolStep(step)) return toolBusyLabel(step.slice('tool:'.length));
  switch (step) {
    case 'discover':
      return 'finding a node';
    case 'reserve':
      return 'approve this call';
    case 'fundPool':
      return `deposit ${TICKET_POOL_ALGO} ALGO for the ticket pool`;
    case 'openEscrow': {
      const amount = amountLabel?.trim() ?? '';
      if (!amount || amount === '0') return 'lock up to 0.10 USDC';
      return `lock up to ${amount} USDC`;
    }
    case 'think':
      return 'thinking';
    case 'settle':
      return 'paying for inference';
  }
}

function toolBusyLabel(name: string): string {
  switch (name) {
    case 'wallet_holdings':
      return 'checking balances';
    default:
      return 'working';
  }
}

/** Short label for the sheet button. Description stays on `payStepLabel`. */
export function payStepAction(step: PayStep, amountLabel?: string): string {
  if (step === 'fundPool') return `deposit ${TICKET_POOL_ALGO} ALGO`;
  if (isToolStep(step)) return 'allow';
  return payStepLabel(step, amountLabel);
}
