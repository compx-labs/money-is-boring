import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { agentGate } from '@/lib/agent/ready';

describe('agent tab gate', () => {
  it('asks for setup until the sheet has finished', () => {
    assert.equal(
      agentGate({ setupDone: false, escrow: true, balancesReady: true, usdcAmount: 5 }),
      'setup',
    );
    assert.equal(
      agentGate({ setupDone: false, escrow: null, balancesReady: false, usdcAmount: 0 }),
      'setup',
    );
  });

  it('waits until escrow is known after setup', () => {
    assert.equal(
      agentGate({ setupDone: true, escrow: null, balancesReady: false, usdcAmount: 0 }),
      'loading',
    );
  });

  it('asks for setup again if escrow is no longer live', () => {
    assert.equal(
      agentGate({ setupDone: true, escrow: false, balancesReady: true, usdcAmount: 5 }),
      'setup',
    );
  });

  it('asks for USDC once escrow is live', () => {
    assert.equal(
      agentGate({ setupDone: true, escrow: true, balancesReady: true, usdcAmount: 0 }),
      'usdc',
    );
  });

  it('opens chat when escrow and USDC are ready', () => {
    assert.equal(
      agentGate({ setupDone: true, escrow: true, balancesReady: true, usdcAmount: 0.01 }),
      'ready',
    );
  });
});
