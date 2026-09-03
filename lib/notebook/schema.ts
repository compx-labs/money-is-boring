/** On-device notebook: standing prefs + notes with FTS5 on body + tags. */
export const NOTEBOOK_SCHEMA = `
CREATE TABLE IF NOT EXISTS notebook_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profile (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  body TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  body,
  tags,
  content='notes',
  content_rowid='id',
  tokenize='porter unicode61'
);

CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
  INSERT INTO notes_fts(rowid, body, tags) VALUES (new.id, new.body, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, body, tags)
    VALUES ('delete', old.id, old.body, old.tags);
END;

CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, body, tags)
    VALUES ('delete', old.id, old.body, old.tags);
  INSERT INTO notes_fts(rowid, body, tags) VALUES (new.id, new.body, new.tags);
END;

INSERT OR IGNORE INTO notebook_meta(key, value) VALUES ('schema', '1');
`;
