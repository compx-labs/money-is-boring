import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { modelIds, orderModels } from '@/lib/zerosignal/discover';

describe('modelIds', () => {
  it('reads string ids and object ids, dropping empties', () => {
    assert.deepEqual(modelIds(['glm-4.7-flash', { id: 'kimi-k2.5' }, '', { id: '' }, 3, null]), [
      'glm-4.7-flash',
      'kimi-k2.5',
    ]);
  });

  it('returns empty when models is missing or not a list', () => {
    assert.deepEqual(modelIds(undefined), []);
    assert.deepEqual(modelIds({ id: 'glm-4.7-flash' }), []);
  });
});

describe('orderModels', () => {
  it('puts the selected model first and sorts the rest', () => {
    assert.deepEqual(orderModels(['zeta', 'alpha', 'mid'], 'mid'), ['mid', 'alpha', 'zeta']);
  });

  it('keeps the selected id even when the catalog omitted it', () => {
    assert.deepEqual(orderModels(['alpha', 'zeta'], 'glm-4.7-flash'), [
      'glm-4.7-flash',
      'alpha',
      'zeta',
    ]);
  });

  it('dedupes and ignores empty ids', () => {
    assert.deepEqual(orderModels(['alpha', 'alpha', ''], 'alpha'), ['alpha']);
  });
});
