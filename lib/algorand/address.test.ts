import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isAlgorandAddress } from '@/lib/algorand/address';

const ZERO = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ';

describe('isAlgorandAddress', () => {
  it('accepts a checksummed address, including surrounding space', () => {
    assert.equal(isAlgorandAddress(ZERO), true);
    assert.equal(isAlgorandAddress(`  ${ZERO}  `), true);
  });

  it('rejects empty, short, and bad-checksum values', () => {
    assert.equal(isAlgorandAddress(''), false);
    assert.equal(isAlgorandAddress('not-an-address'), false);
    assert.equal(isAlgorandAddress(ZERO.slice(0, -1) + 'A'), false);
  });
});
