import type { AgentTool, AgentToolResult } from '@mariozechner/pi-agent-core';
import type { TSchema } from 'typebox';
import { agentToolSchemas, runAgentTool } from '@/lib/agent/host';
import type { CompiledHttpTool } from '@/lib/agent/http-tools';
import type { AgentToolContext } from '@/lib/agent/types';

export type HostToolDetails = { paidMicro: bigint };

export type HostToolConfirm = {
  confirmTools?: boolean;
  awaitSign?: () => Promise<void>;
};

export async function confirmToolIfNeeded(opts?: HostToolConfirm): Promise<void> {
  if (opts?.confirmTools) await opts.awaitSign?.();
}

/** Wrap in-wallet host tools as pi-agent-core tools. Same names and JSON schemas. */
export function hostToolsAsPi(
  ctx: AgentToolContext,
  suite: CompiledHttpTool[] = [],
  opts?: HostToolConfirm,
): AgentTool<TSchema, HostToolDetails>[] {
  return agentToolSchemas(suite).map((schema) => ({
    name: schema.name,
    label: schema.name,
    description: schema.description,
    parameters: schema.parameters as TSchema,
    executionMode: 'sequential' as const,
    async execute(_id, params): Promise<AgentToolResult<HostToolDetails>> {
      await confirmToolIfNeeded(opts);
      const result = await runAgentTool(schema.name, JSON.stringify(params ?? {}), ctx, suite);
      return {
        content: [{ type: 'text', text: result.output }],
        details: { paidMicro: result.paidMicro },
      };
    },
  }));
}
