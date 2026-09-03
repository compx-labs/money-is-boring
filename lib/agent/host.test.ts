import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AGENT_SYSTEM_PROMPT, agentToolSchemas } from '@/lib/agent/host';

describe('agent live tools', () => {
  it('exposes now-fetched holdings and positions, not a notebook cache', () => {
    const names = agentToolSchemas().map((t) => t.name);
    assert.ok(names.includes('wallet_holdings'));
    assert.ok(names.includes('canix_positions'));
    assert.ok(names.includes('canix_hay_quote'));
    assert.match(AGENT_SYSTEM_PROMPT, /Fetch balances, prices, and positions with tools now/);
    assert.match(AGENT_SYSTEM_PROMPT, /on-device memory, not live chain state/);
  });
});
