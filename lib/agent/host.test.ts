import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AGENT_SYSTEM_PROMPT, agentToolSchemas, runAgentTool } from '@/lib/agent/host';
import type { CompiledHttpTool } from '@/lib/agent/http-tools';
import type { AgentToolContext } from '@/lib/agent/types';

const ctx: AgentToolContext = {
  store: { sign: async () => new Uint8Array() },
  keyId: 'k',
  address: 'ADDR',
};

const httpFixture: CompiledHttpTool = {
  name: 'get_opportunities',
  description: 'List opportunities',
  method: 'GET',
  url: 'https://canix402-api.compx.io/opportunities',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
};

describe('agent live tools', () => {
  it('always exposes wallet holdings and no hardcoded Canix names', () => {
    const names = agentToolSchemas().map((t) => t.name);
    assert.deepEqual(names, ['wallet_holdings']);
    assert.ok(!names.some((name) => name.startsWith('canix_')));
    assert.match(AGENT_SYSTEM_PROMPT, /Fetch balances, prices, and positions with tools now/);
    assert.match(AGENT_SYSTEM_PROMPT, /on-device memory, not live chain state/);
  });

  it('attaches compiled HTTP tools from a loaded suite', () => {
    const names = agentToolSchemas([httpFixture]).map((t) => t.name);
    assert.deepEqual(names, ['wallet_holdings', 'get_opportunities']);
  });

  it('runs a compiled GET tool through paidRequest', async () => {
    const calls: Array<{ url: string; method?: string; body?: unknown }> = [];
    const orig = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), method: init?.method, body: init?.body });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
    try {
      const result = await runAgentTool(
        'get_opportunities',
        JSON.stringify({ limit: 8 }),
        ctx,
        [httpFixture],
      );
      assert.equal(calls.length, 1);
      assert.equal(calls[0]?.method, 'GET');
      assert.equal(calls[0]?.url, 'https://canix402-api.compx.io/opportunities?limit=8');
      assert.equal(calls[0]?.body, undefined);
      assert.equal(JSON.parse(result.output).ok, true);
    } finally {
      globalThis.fetch = orig;
    }
  });
});
