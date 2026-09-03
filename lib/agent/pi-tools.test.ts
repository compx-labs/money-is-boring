import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { agentToolSchemas } from '@/lib/agent/host';
import type { CompiledHttpTool } from '@/lib/agent/http-tools';
import { confirmToolIfNeeded, hostToolsAsPi } from '@/lib/agent/pi-tools';
import { ZS_API, ZS_PROVIDER } from '@/lib/zerosignal/context';

const ctx = {
  store: { sign: async () => new Uint8Array() },
  keyId: 'k',
  address: 'ADDR',
};

const suite: CompiledHttpTool[] = [
  {
    name: 'get_opportunities',
    description: 'List opportunities',
    method: 'GET',
    url: 'https://example.com/opportunities',
    parameters: { type: 'object', properties: {} },
  },
];

describe('pi host tool wrappers', () => {
  it('keeps the same tool names as the in-wallet host', () => {
    const wrapped = hostToolsAsPi(ctx);
    assert.deepEqual(
      wrapped.map((tool) => tool.name),
      agentToolSchemas().map((tool) => tool.name),
    );
    assert.deepEqual(
      wrapped.map((tool) => tool.name),
      ['wallet_holdings'],
    );
    assert.ok(wrapped.every((tool) => tool.executionMode === 'sequential'));
  });

  it('wraps a compiled HTTP suite alongside wallet tools', () => {
    const wrapped = hostToolsAsPi(ctx, suite);
    assert.deepEqual(
      wrapped.map((tool) => tool.name),
      agentToolSchemas(suite).map((tool) => tool.name),
    );
    assert.deepEqual(
      wrapped.map((tool) => tool.name),
      ['wallet_holdings', 'get_opportunities'],
    );
  });

  it('waits for confirm before execute when tools are on', async () => {
    let waited = false;
    const wrapped = hostToolsAsPi(ctx, [], {
      confirmTools: true,
      awaitSign: async () => {
        waited = true;
        throw new Error('sign cancelled');
      },
    });
    await assert.rejects(() => wrapped[0]!.execute('1', {}), /sign cancelled/);
    assert.equal(waited, true);
  });

  it('does not wait when tools confirm is off', async () => {
    let waited = false;
    await confirmToolIfNeeded({
      confirmTools: false,
      awaitSign: async () => {
        waited = true;
      },
    });
    assert.equal(waited, false);
  });
});

describe('inference seam constants', () => {
  it('names a custom zerosignal api, not openai-completions', () => {
    assert.equal(ZS_PROVIDER, 'zerosignal');
    assert.equal(ZS_API, 'zerosignal-sealed');
    assert.notEqual(ZS_API, 'openai-completions');
    assert.notEqual(ZS_API, 'openai-responses');
  });
});
