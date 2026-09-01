import { canixProvider } from '@/lib/canix/tools';
import type { AgentToolContext, AgentToolProvider } from '@/lib/agent/types';

const providers: AgentToolProvider[] = [canixProvider];

export const AGENT_SYSTEM_PROMPT =
  'You are the in-wallet agent for Money is Boring, a simple Algorand wallet. Be concise. Tools run on this device against remotes. This wallet signs and submits; remotes do not broadcast. Never claim a swap or transfer landed unless a tool returned a transaction id. Do not mention internal spend limits or bypass API keys.';

export function agentToolSchemas() {
  return providers.flatMap((provider) => provider.tools);
}

export async function runAgentTool(
  name: string,
  rawArgs: string,
  ctx: AgentToolContext,
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
    for (const provider of providers) {
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
