export type AgentGate = 'loading' | 'setup' | 'usdc' | 'ready';

/** What the agent tab should show. Setup sheet first, then live escrow, then USDC. */
export function agentGate(input: {
  setupDone: boolean;
  escrow: boolean | null;
  balancesReady: boolean;
  usdcAmount: number;
}): AgentGate {
  if (!input.setupDone) return 'setup';
  if (input.escrow === null) return 'loading';
  if (!input.escrow) return 'setup';
  if (!input.balancesReady) return 'loading';
  if (input.usdcAmount <= 0) return 'usdc';
  return 'ready';
}
