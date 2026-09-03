import { NOTEBOOK_SCHEMA } from '@/lib/notebook/schema';
import { searchNotes, type NotebookDb } from '@/lib/notebook/fts';
import {
  BLOCKED_MEMORY_KEY,
  isProfileKey,
  type ProfilePref,
} from '@/lib/notebook/types';

export async function migrateNotebook(db: NotebookDb): Promise<void> {
  await db.exec(NOTEBOOK_SCHEMA);
}

export async function readProfile(db: NotebookDb): Promise<ProfilePref[]> {
  const rows = await db.all<ProfilePref>('SELECT key, value FROM profile ORDER BY key');
  return rows.filter(
    (row) =>
      isProfileKey(row.key) &&
      typeof row.value === 'string' &&
      row.value.trim() !== '' &&
      !BLOCKED_MEMORY_KEY.test(row.key) &&
      !BLOCKED_MEMORY_KEY.test(row.value),
  );
}

export async function setProfileValue(db: NotebookDb, key: string, value: string): Promise<void> {
  if (!isProfileKey(key) || BLOCKED_MEMORY_KEY.test(key)) {
    throw new Error('unknown profile key');
  }
  const trimmed = value.trim().slice(0, 80);
  if (!trimmed || BLOCKED_MEMORY_KEY.test(trimmed)) {
    await db.run('DELETE FROM profile WHERE key = ?', [key]);
    return;
  }
  await db.run(
    'INSERT INTO profile(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, trimmed],
  );
}

export async function insertNote(db: NotebookDb, body: string, tags = ''): Promise<number> {
  const text = body.trim().slice(0, 280);
  if (!text) throw new Error('empty note');
  const now = Date.now();
  const result = await db.run(
    'INSERT INTO notes (body, tags, created_at, updated_at) VALUES (?, ?, ?, ?)',
    [text, tags.trim().slice(0, 80), now, now],
  );
  return result.lastInsertRowId;
}

export { searchNotes };
export type { NotebookDb };
