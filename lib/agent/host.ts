import { httpSuiteProvider, type CompiledHttpTool } from '@/lib/agent/http-tools';
import { walletProvider } from '@/lib/agent/wallet';
import type { AgentToolContext, AgentToolProvider } from '@/lib/agent/types';

export const AGENT_SYSTEM_PROMPT =
  'You are the in-wallet agent for Money is Boring, a simple Algorand wallet. Be concise. Tools run on this device against remotes. This wallet signs and submits; remotes do not broadcast. Never claim a swap or transfer landed unless a tool returned a transaction id. Do not mention internal spend limits or bypass API keys. Standing prefs and notes are on-device memory, not live chain state. Fetch balances, prices, and positions with tools now.';

function providersFor(suite: CompiledHttpTool[] = []): AgentToolProvider[] {
  return suite.length > 0 ? [walletProvider, httpSuiteProvider(suite)] : [walletProvider];
}

export function agentToolSchemas(suite: CompiledHttpTool[] = []) {
  return providersFor(suite).flatMap((provider) => provider.tools);
}

export async function runAgentTool(
  name: string,
  rawArgs: string,
  ctx: AgentToolContext,
  suite: CompiledHttpTool[] = [],
): Promise<{ output: string; paidMicro: bigint }> {
  let args: Record<string, unknown> = {};
  if (rawArgs.trim()) {
    try {
      const parsed: unknown = JSON.parse(rawArgs);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        args = parsed as Record<string, unknown>;
      }
    } catch {
      return { output: JSON.stringify({ error: 'Tool arguments were not JSON' }), paidMicro: 0n };
    }
  }

  try {
    for (const provider of providersFor(suite)) {
      const result = await provider.run(name, args, ctx);
      if (result) return { output: JSON.stringify(result.body), paidMicro: result.paidMicro };
    }
    return { output: JSON.stringify({ error: `Unknown tool ${name}` }), paidMicro: 0n };
  } catch (e) {
    return {
      output: JSON.stringify({ error: e instanceof Error ? e.message : 'Tool failed' }),
      paidMicro: 0n,
    };
  }
}
