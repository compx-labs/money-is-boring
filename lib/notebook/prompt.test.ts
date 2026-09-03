import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { composeAgentInput, formatNotebookPreamble, lastTurns } from '@/lib/notebook/prompt';
import { BLOCKED_MEMORY_KEY } from '@/lib/notebook/types';
import { readProfile, setProfileValue, type NotebookDb } from '@/lib/notebook/sql';

function memoryDb(profile: { key: string; value: string }[] = []): NotebookDb {
  const rows = [...profile];
  return {
    exec: async () => {},
    run: async (sql, params) => {
      if (sql.startsWith('DELETE')) {
        const key = String(params?.[0]);
        const idx = rows.findIndex((r) => r.key === key);
        if (idx >= 0) rows.splice(idx, 1);
      } else if (sql.startsWith('INSERT')) {
        const key = String(params?.[0]);
        const value = String(params?.[1]);
        const existing = rows.find((r) => r.key === key);
        if (existing) existing.value = value;
        else rows.push({ key, value });
      }
      return { lastInsertRowId: 0 };
    },
    all: async () => rows,
  };
}

describe('notebook prompt', () => {
  it('injects standing prefs and 3–5 notes as lines, not a JSON blob', () => {
    const text = formatNotebookPreamble(
      [{ key: 'preferred_asset', value: 'USDC' }, { key: 'risk', value: 'conservative' }],
      [
        { id: 1, body: 'prefer Tinyman for small swaps', tags: 'dex' },
        { id: 2, body: 'keep spare ALGO for fees', tags: 'fees' },
        { id: 3, body: 'never auto-enter leverage', tags: 'risk' },
      ],
    );
    assert.match(text, /Standing prefs:/);
    assert.match(text, /preferred asset: USDC/);
    assert.match(text, /Related notes:/);
    assert.match(text, /- prefer Tinyman for small swaps \(dex\)/);
    assert.equal(text.includes('{'), false);
    assert.match(text, /Fetch them now with tools/);
    assert.doesNotMatch(text, /"preferred_asset"/);
  });

  it('empty notebook still says balances are live via tools', () => {
    const text = formatNotebookPreamble([], []);
    assert.match(text, /No standing prefs or notes/);
    assert.match(text, /Live balances, prices, and positions/);
  });

  it('keeps the last K turns and prepends system memory', () => {
    const history = [
      { role: 'user' as const, text: 'old 1' },
      { role: 'assistant' as const, text: 'old 2' },
      { role: 'user' as const, text: 'mid' },
      { role: 'assistant' as const, text: 'mid reply' },
      { role: 'user' as const, text: 'swap USDC' },
    ];
    const input = composeAgentInput({
      system: 'You are the in-wallet agent.',
      profile: [{ key: 'preferred_asset', value: 'USDC' }],
      hits: [{ id: 1, body: 'prefer Tinyman', tags: 'dex' }],
      history,
      lastTurns: 1,
    });
    assert.equal(input[0]?.role, 'system');
    assert.match(input[0]?.content ?? '', /You are the in-wallet agent/);
    assert.match(input[0]?.content ?? '', /preferred asset: USDC/);
    assert.match(input[0]?.content ?? '', /prefer Tinyman/);
    assert.deepEqual(
      input.slice(1).map((m) => m.content),
      ['mid reply', 'swap USDC'],
    );
    assert.equal(lastTurns(history, 6).length, 5);
  });

  it('read path drops live-balance profile keys', async () => {
    const db = memoryDb([
      { key: 'preferred_asset', value: 'USDC' },
      { key: 'risk', value: 'balance 99 ALGO' },
      { key: 'nickname', value: 'kieran' },
    ]);
    const profile = await readProfile(db);
    assert.deepEqual(profile, [
      { key: 'preferred_asset', value: 'USDC' },
      { key: 'nickname', value: 'kieran' },
    ]);
    await assert.rejects(() => setProfileValue(db, 'balance', '1'));
    assert.ok(BLOCKED_MEMORY_KEY.test('holdings'));
    assert.ok(!BLOCKED_MEMORY_KEY.test('USDC'));
  });
});
