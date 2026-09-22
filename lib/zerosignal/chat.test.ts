import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { maybeWaitToSpend } from '@/lib/zerosignal/chat';

describe('inference spend confirm', () => {
  it('does not wait to spend for openEscrow when inference confirm is off', async () => {
    let waited = 0;
    await maybeWaitToSpend(
      { awaitSign: async () => { waited += 1; } },
      'openEscrow',
      '0.01',
      false,
    );
    assert.equal(waited, 0);
  });

  it('waits to spend for openEscrow when inference confirm is on', async () => {
    let waited = 0;
    await maybeWaitToSpend(
      { awaitSign: async () => { waited += 1; } },
      'openEscrow',
      '0.01',
      true,
    );
    assert.equal(waited, 1);
  });

  it('always waits for ticket-pool setup', async () => {
    let waited = 0;
    await maybeWaitToSpend(
      { awaitSign: async () => { waited += 1; } },
      'fundPool',
      undefined,
      false,
    );
    assert.equal(waited, 1);
  });
});
