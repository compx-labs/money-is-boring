import { BLOCKED_MEMORY_KEY, NOTEBOOK_HIT_LIMIT, type NotebookHit } from '@/lib/notebook/types';

export type NotebookDb = {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: (string | number)[]): Promise<{ lastInsertRowId: number }>;
  all<T>(sql: string, params?: (string | number)[]): Promise<T[]>;
};

const STOP = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'if',
  'then',
  'so',
  'to',
  'of',
  'in',
  'on',
  'for',
  'at',
  'by',
  'as',
  'is',
  'it',
  'be',
  'do',
  'did',
  'does',
  'am',
  'are',
  'was',
  'were',
  'i',
  'me',
  'my',
  'we',
  'you',
  'your',
  'please',
  'what',
  'whats',
  'when',
  'where',
  'why',
  'how',
  'can',
  'could',
  'would',
  'should',
  'will',
  'just',
  'this',
  'that',
  'with',
  'from',
  'about',
  'into',
  'over',
  'need',
  'want',
  'get',
  'got',
  'show',
  'tell',
  'give',
  'make',
  'use',
  'using',
  'also',
  'not',
  'no',
  'yes',
]);

export const SEARCH_SQL = `
SELECT notes.id AS id, notes.body AS body, notes.tags AS tags
FROM notes_fts
JOIN notes ON notes.id = notes_fts.rowid
WHERE notes_fts MATCH ?
ORDER BY rank
LIMIT ?
`;

/** Keyword tokens from a user message. Safe for FTS5 MATCH. */
export function tokenize(message: string): string[] {
  const words = message.toLowerCase().match(/[a-z0-9_]+/g) ?? [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const word of words) {
    if (word.length < 2 || STOP.has(word) || seen.has(word)) continue;
    seen.add(word);
    out.push(word);
    if (out.length >= 8) break;
  }
  return out;
}

/** Quoted OR query, or null when the message has no searchable terms. */
export function ftsMatchQuery(message: string): string | null {
  const tokens = tokenize(message);
  if (tokens.length === 0) return null;
  return tokens.map((token) => `"${token.replace(/"/g, '')}"`).join(' OR ');
}

export async function searchNotes(
  db: NotebookDb,
  message: string,
  limit = NOTEBOOK_HIT_LIMIT,
): Promise<NotebookHit[]> {
  const match = ftsMatchQuery(message);
  if (!match) return [];
  const cap = Math.min(NOTEBOOK_HIT_LIMIT, Math.max(1, limit));
  try {
    const rows = await db.all<NotebookHit>(SEARCH_SQL, [match, cap]);
    return rows.filter((row) => !BLOCKED_MEMORY_KEY.test(row.body) && !BLOCKED_MEMORY_KEY.test(row.tags));
  } catch {
    return [];
  }
}
