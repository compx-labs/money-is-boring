import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isAuthCanceled } from '@/lib/keystore/auth-options';

describe('isAuthCanceled', () => {
  it('treats cancel and failed biometric as a blocked sign', () => {
    assert.equal(isAuthCanceled(new Error('User canceled authentication')), true);
    assert.equal(isAuthCanceled(new Error('Authentication failed')), true);
    assert.equal(isAuthCanceled(new Error('overspend')), false);
  });
});
