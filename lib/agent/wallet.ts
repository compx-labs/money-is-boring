import { fetchBalances } from '@/lib/algorand/balances';
import type { AgentToolContext, AgentToolProvider, AgentToolResult } from '@/lib/agent/types';

async function holdings(ctx: AgentToolContext): Promise<AgentToolResult> {
  const now = await fetchBalances(ctx.address);
  return {
    paidMicro: 0n,
    body: {
      fetched: 'now',
      source: 'algod',
      error: now.error,
      holdings: now.holdings
        .filter((h) => h.amount != null)
        .map((h) => ({
          assetId: h.id,
          unit: h.unit,
          amount: h.amount,
          decimals: h.decimals,
        })),
    },
  };
}

export const walletProvider: AgentToolProvider = {
  id: 'wallet',
  tools: [
    {
      type: 'function',
      name: 'wallet_holdings',
      description:
        'Live ALGO and ASA balances on this wallet right now from algod. Do not treat notebook notes as balances.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  async run(name, _args, ctx) {
    if (name !== 'wallet_holdings') return null;
    return holdings(ctx);
  },
};
