import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { reuseAuth, transactionAuth } from '@/lib/keystore/auth-options';
import { authForTurnSign, wrapTurnSigner } from '@/lib/agent/turn-auth';

describe('turn Face ID', () => {
  it('Face IDs on reserve when either confirm is off, then reuses', () => {
    assert.equal(authForTurnSign(0, true), transactionAuth);
    assert.equal(authForTurnSign(1, true), reuseAuth);
    assert.equal(authForTurnSign(2, true), reuseAuth);
  });

  it('skips Face ID on reserve when both confirms are on', () => {
    assert.equal(authForTurnSign(0, false), undefined);
    assert.equal(authForTurnSign(1, false), transactionAuth);
    assert.equal(authForTurnSign(2, false), reuseAuth);
  });

  it('keeps explicit settle reuseAuth off the turn counter', async () => {
    const seen: unknown[] = [];
    const wrapped = wrapTurnSigner(
      {
        sign: async (_keyId, _data, _metadata, options) => {
          seen.push(options);
          return new Uint8Array();
        },
      },
      false,
    );
    await wrapped.sign('k', new Uint8Array(), undefined, reuseAuth);
    await wrapped.sign('k', new Uint8Array());
    await wrapped.sign('k', new Uint8Array());
    assert.equal(seen[0], reuseAuth);
    assert.equal(seen[1], undefined);
    assert.equal(seen[2], transactionAuth);
  });
});
