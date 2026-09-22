import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { utf8 } from '@/lib/zerosignal/bytes';
import { ageDecrypt, ageEncrypt, newAgeIdentity } from '@/lib/zerosignal/wire';

describe('age seal on streams', () => {
  it('round-trips bytes without going through Response.arrayBuffer', async () => {
    const id = await newAgeIdentity();
    const plain = utf8('{"model":"glm-4.7-flash"}');
    const sealed = await ageEncrypt(id.recipient, plain);
    const intro = new TextDecoder().decode(sealed.subarray(0, 21));
    assert.equal(intro, 'age-encryption.org/v1');
    assert.deepEqual(await ageDecrypt(id.secret, sealed), plain);
  });
});
