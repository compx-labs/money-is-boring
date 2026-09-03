import * as SQLite from 'expo-sqlite';
import {
  ACCESS_CONTROL,
  ACCESSIBLE,
  getGenericPassword,
  setGenericPassword,
  STORAGE_TYPE,
} from 'react-native-keychain';
import { prefs } from '@/lib/prefs';
import { keyFromHex, keyToHex, openNotebookBlob, randomNotebookKey, sealNotebookBlob } from '@/lib/notebook/crypto';
import { searchNotes } from '@/lib/notebook/fts';
import { insertNote, migrateNotebook, readProfile, setProfileValue, type NotebookDb } from '@/lib/notebook/sql';
import type { NotebookContext, ProfileKey } from '@/lib/notebook/types';
import { NOTEBOOK_HIT_LIMIT } from '@/lib/notebook/types';

const KEYCHAIN_SERVICE = 'io.compx.moneyisboring.notebook';
const BLOB_PREF = 'notebook.sealed.v1';
const AUTH_PROMPT = { title: 'Unlock notebook', cancel: 'Cancel' };
const AUTH_WINDOW_SEC = 30;

/**
 * SQLCipher would collide with react-native-quick-crypto on Android
 * (`libcrypto.so`). The sqlite image is serialized, sealed with the
 * Face ID/PIN key, and deserialized in memory for FTS5.
 */
type Session = { db: SQLite.SQLiteDatabase; key: Uint8Array; sql: NotebookDb };

let session: Session | null = null;
let opening: Promise<Session | null> | null = null;
let cachedKey: Uint8Array | null = null;

function wrapDb(db: SQLite.SQLiteDatabase): NotebookDb {
  return {
    exec: (sql) => db.execAsync(sql),
    run: async (sql, params) => db.runAsync(sql, params ?? []),
    all: (sql, params) => db.getAllAsync(sql, params ?? []),
  };
}

function keychainOpts() {
  return {
    service: KEYCHAIN_SERVICE,
    accessControl: ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
    accessible: ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    storage: STORAGE_TYPE.AES_GCM,
    authenticationValidityDuration: AUTH_WINDOW_SEC,
    authenticationPrompt: AUTH_PROMPT,
  };
}

async function loadOrCreateKey(): Promise<Uint8Array> {
  if (cachedKey) return cachedKey;
  const existing = await getGenericPassword(keychainOpts());
  if (existing && existing.password) {
    cachedKey = keyFromHex(existing.password);
    return cachedKey;
  }
  const key = randomNotebookKey();
  const saved = await setGenericPassword('notebook', keyToHex(key), keychainOpts());
  if (!saved) throw new Error('could not protect notebook key');
  cachedKey = key;
  return key;
}

async function persist(sessionNow: Session): Promise<void> {
  const plain = await sessionNow.db.serializeAsync();
  const sealed = sealNotebookBlob(sessionNow.key, plain);
  prefs.set(BLOB_PREF, Buffer.from(sealed).toString('base64'));
}

async function openSession(): Promise<Session> {
  const key = await loadOrCreateKey();
  const b64 = prefs.getString(BLOB_PREF);
  let db: SQLite.SQLiteDatabase;
  if (b64) {
    try {
      const plain = openNotebookBlob(key, Uint8Array.from(Buffer.from(b64, 'base64')));
      db = await SQLite.deserializeDatabaseAsync(plain);
    } catch {
      prefs.remove(BLOB_PREF);
      db = await SQLite.openDatabaseAsync(':memory:');
    }
  } else {
    db = await SQLite.openDatabaseAsync(':memory:');
  }
  const sql = wrapDb(db);
  await migrateNotebook(sql);
  return { db, key, sql };
}

async function ensureSession(): Promise<Session | null> {
  if (session) return session;
  if (!opening) {
    opening = openSession()
      .then((next) => {
        session = next;
        return next;
      })
      .catch(() => null)
      .finally(() => {
        opening = null;
      });
  }
  return opening;
}

/** Face ID/PIN unlock so the first chat turn does not wait on keychain. */
export async function warmupNotebook(): Promise<void> {
  await ensureSession();
}

export async function loadNotebookContext(message: string): Promise<NotebookContext> {
  const current = await ensureSession();
  if (!current) return { profile: [], hits: [] };
  try {
    const [profile, hits] = await Promise.all([
      readProfile(current.sql),
      searchNotes(current.sql, message, NOTEBOOK_HIT_LIMIT),
    ]);
    return { profile, hits };
  } catch {
    return { profile: [], hits: [] };
  }
}

export async function insertNoteAndPersist(body: string, tags = ''): Promise<number | null> {
  const current = await ensureSession();
  if (!current) return null;
  const id = await insertNote(current.sql, body, tags);
  await persist(current);
  return id;
}

export async function setProfileAndPersist(key: ProfileKey, value: string): Promise<boolean> {
  const current = await ensureSession();
  if (!current) return false;
  await setProfileValue(current.sql, key, value);
  await persist(current);
  return true;
}
