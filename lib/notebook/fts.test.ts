import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ftsMatchQuery, SEARCH_SQL, searchNotes, tokenize, type NotebookDb } from '@/lib/notebook/fts';
import { NOTEBOOK_HIT_LIMIT } from '@/lib/notebook/types';
import { NOTEBOOK_SCHEMA } from '@/lib/notebook/schema';

describe('notebook FTS query', () => {
  it('drops stopwords and quotes tokens for MATCH', () => {
    assert.deepEqual(tokenize('please swap my USDC for ALGO'), ['swap', 'usdc', 'algo']);
    assert.equal(ftsMatchQuery('please swap my USDC for ALGO'), '"swap" OR "usdc" OR "algo"');
  });

  it('returns null when the message is only stopwords', () => {
    assert.equal(ftsMatchQuery('what can you do for me'), null);
  });

  it('strips MATCH metacharacters instead of passing them through', () => {
    const q = ftsMatchQuery('NEAR ^ tinyman "pact');
    assert.equal(q, '"near" OR "tinyman" OR "pact"');
    assert.ok(!q?.includes('*'));
    assert.ok(!q?.includes('^'));
  });

  it('schema and search SQL use FTS5 on body + tags', () => {
    assert.match(NOTEBOOK_SCHEMA, /CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5/);
    assert.match(NOTEBOOK_SCHEMA, /tokenize='porter unicode61'/);
    assert.match(SEARCH_SQL, /notes_fts MATCH \?/);
    assert.match(SEARCH_SQL, /LIMIT \?/);
  });

  it('takes at most 5 hits and skips live-balance-shaped notes', async () => {
    const calls: { sql: string; params: unknown[] }[] = [];
    const db: NotebookDb = {
      exec: async () => {},
      run: async () => ({ lastInsertRowId: 0 }),
      all: async (sql, params) => {
        calls.push({ sql, params: params ?? [] });
        const cap = typeof params?.[1] === 'number' ? params[1] : NOTEBOOK_HIT_LIMIT;
        return [
          { id: 1, body: 'prefer Tinyman for small swaps', tags: 'dex' },
          { id: 2, body: 'keep spare ALGO for fees', tags: 'fees' },
          { id: 3, body: 'balance 1234.5 ALGO', tags: '' },
          { id: 4, body: 'never auto-enter leverage', tags: 'risk' },
          { id: 5, body: 'USDC for spending', tags: 'spend' },
          { id: 6, body: 'extra hit past the cap', tags: '' },
        ].slice(0, cap);
      },
    };
    const hits = await searchNotes(db, 'tinyman swap USDC', 9);
    assert.equal(calls[0]?.params[1], NOTEBOOK_HIT_LIMIT);
    assert.deepEqual(
      hits.map((h) => h.id),
      [1, 2, 4, 5],
    );
    assert.ok(hits.every((h) => !/balance/i.test(h.body)));
  });
});
