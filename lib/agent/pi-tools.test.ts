import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { agentToolSchemas } from '@/lib/agent/host';
import { hostToolsAsPi } from '@/lib/agent/pi-tools';
import { ZS_API, ZS_PROVIDER } from '@/lib/zerosignal/context';

describe('pi host tool wrappers', () => {
  it('keeps the same tool names as the in-wallet host', () => {
    const wrapped = hostToolsAsPi({
      store: { sign: async () => new Uint8Array() },
      keyId: 'k',
      address: 'ADDR',
    });
    assert.deepEqual(
      wrapped.map((tool) => tool.name),
      agentToolSchemas().map((tool) => tool.name),
    );
    assert.ok(wrapped.every((tool) => tool.executionMode === 'sequential'));
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
