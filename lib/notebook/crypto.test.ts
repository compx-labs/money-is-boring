import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { keyFromHex, keyToHex, openNotebookBlob, randomNotebookKey, sealNotebookBlob } from '@/lib/notebook/crypto';

describe('notebook seal', () => {
  it('round-trips a sqlite image and fails on a wrong key', () => {
    const key = randomNotebookKey();
    const plain = new TextEncoder().encode('notes fts5 standing prefs');
    const blob = sealNotebookBlob(key, plain);
    assert.notEqual(Buffer.from(blob).toString('utf8'), Buffer.from(plain).toString('utf8'));
    assert.deepEqual(openNotebookBlob(key, blob), plain);
    const other = randomNotebookKey();
    assert.throws(() => openNotebookBlob(other, blob));
  });

  it('hex-encodes a 32-byte key for the biometric keychain', () => {
    const key = randomNotebookKey();
    const hex = keyToHex(key);
    assert.equal(hex.length, 64);
    assert.deepEqual(keyFromHex(hex), key);
    assert.throws(() => keyFromHex('zz'));
  });
});
