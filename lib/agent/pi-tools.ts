import type { AgentTool, AgentToolResult } from '@mariozechner/pi-agent-core';
import type { TSchema } from 'typebox';
import { agentToolSchemas, runAgentTool } from '@/lib/agent/host';
import type { AgentToolContext } from '@/lib/agent/types';

export type HostToolDetails = { paidMicro: bigint };

/** Wrap in-wallet host tools as pi-agent-core tools. Same names and JSON schemas. */
export function hostToolsAsPi(ctx: AgentToolContext): AgentTool<TSchema, HostToolDetails>[] {
  return agentToolSchemas().map((schema) => ({
    name: schema.name,
    label: schema.name,
    description: schema.description,
    parameters: schema.parameters as TSchema,
    executionMode: 'sequential' as const,
    async execute(_id, params): Promise<AgentToolResult<HostToolDetails>> {
      const result = await runAgentTool(schema.name, JSON.stringify(params ?? {}), ctx);
      return {
        content: [{ type: 'text', text: result.output }],
        details: { paidMicro: result.paidMicro },
      };
    },
  }));
}
