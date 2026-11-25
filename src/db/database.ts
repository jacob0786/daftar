import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';

import { foldForSearch } from '@/lib/text';
import type { ChecklistItem, ColorIndex, Label, Note, NoteFormat, NoteKind, NoteStatus } from './types';

const DB_NAME = 'notes.db';
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

// --- Opening + schema ---
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = open();
  return dbPromise;
}

async function open() {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL DEFAULT 'text',
      items TEXT NOT NULL DEFAULT '[]',
      color INTEGER,
      labels TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'active',
      pinned INTEGER NOT NULL DEFAULT 0,
      locked INTEGER NOT NULL DEFAULT 0,
      cipher TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      search TEXT NOT NULL DEFAULT '',
      dirty INTEGER NOT NULL DEFAULT 1,
      seen INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS notes_dirty ON notes (dirty);
    CREATE TABLE IF NOT EXISTS labels (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      dirty INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT 0,
      dirty INTEGER NOT NULL DEFAULT 0
    );
  `);
  await migrate(db);
  return db;
}

// Version 2: separate "edited" date from the sync clock, a calendar date per note, and formatting
async function migrate(db: SQLite.SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if ((row?.user_version ?? 0) < 2) {
    await db.execAsync(`
      ALTER TABLE notes ADD COLUMN edited_at INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE notes ADD COLUMN date_at INTEGER;
      ALTER TABLE notes ADD COLUMN format TEXT NOT NULL DEFAULT 'plain';
      UPDATE notes SET edited_at = updated_at;
      CREATE INDEX IF NOT EXISTS notes_edited ON notes (deleted, status, edited_at);
      CREATE INDEX IF NOT EXISTS notes_date ON notes (deleted, date_at);
      PRAGMA user_version = 2;
    `);
  }
}

// --- Change notifications so screens refresh after any write ---
type Listener = () => void;
const listeners = new Set<Listener>();
export function onNotesChanged(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export function emitChange() {
  listeners.forEach((fn) => fn());
}

// --- Row <-> Note ---
export type NoteRow = {
  id: string; title: string; body: string; kind: string; items: string; color: number | null;
  labels: string; status: string; pinned: number; locked: number; cipher: string | null;
  format: string; date_at: number | null;
  created_at: number; edited_at: number; updated_at: number; seen: number; dirty: number; deleted: number;
};

export function toNote(r: NoteRow): Note {
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    kind: r.kind as NoteKind,
    items: JSON.parse(r.items || '[]') as ChecklistItem[],
    color: r.color as ColorIndex | null,
    labels: JSON.parse(r.labels || '[]') as string[],
    status: r.status as NoteStatus,
    pinned: !!r.pinned,
    locked: !!r.locked,
    cipher: r.cipher,
    format: (r.format as NoteFormat) || 'plain',
    dateAt: r.date_at ?? null,
    createdAt: r.created_at,
    editedAt: r.edited_at || r.updated_at,
    updatedAt: r.updated_at,
    seen: !!r.seen,
  };
}

export function searchTextFor(n: Pick<Note, 'title' | 'body' | 'items' | 'locked'>) {
  // Locked notes are only searchable by title
  const content = n.locked ? '' : [n.body, ...n.items.map((i) => i.text)].join('\n');
  return foldForSearch(`${n.title}\n${content}`);
}

// --- Reads ---
export type SortOrder = 'edited' | 'created' | 'title' | 'color' | 'date';
export type ListFilter = { status: NoteStatus; color?: ColorIndex | null; labelId?: string; kind?: NoteKind; query?: string; sort?: SortOrder };

const ORDER: Record<SortOrder, string> = {
  edited: 'edited_at DESC',
  created: 'created_at DESC',
  title: "CASE WHEN title = '' THEN 1 ELSE 0 END, title COLLATE NOCASE ASC, edited_at DESC",
  color: 'CASE WHEN color IS NULL THEN 99 ELSE color END ASC, edited_at DESC',
  date: 'CASE WHEN date_at IS NULL THEN 1 ELSE 0 END, date_at ASC, edited_at DESC',
};

export async function listNotes(f: ListFilter): Promise<Note[]> {
  const db = await getDb();
  const where = ['deleted = 0', 'status = ?'];
  const args: (string | number)[] = [f.status];
  if (f.color !== undefined && f.color !== null) { where.push('color = ?'); args.push(f.color); }
  if (f.kind) { where.push('kind = ?'); args.push(f.kind); }
  if (f.labelId) { where.push("EXISTS (SELECT 1 FROM json_each(notes.labels) WHERE value = ?)"); args.push(f.labelId); }
  if (f.query?.trim()) { where.push('search LIKE ?'); args.push(`%${foldForSearch(f.query.trim())}%`); }
  const rows = await db.getAllAsync<NoteRow>(
    `SELECT * FROM notes WHERE ${where.join(' AND ')} ORDER BY pinned DESC, ${ORDER[f.sort ?? 'edited']}`,
    args,
  );
  return rows.map(toNote);
}

// Notes with a calendar date between two times (active and archived)
export async function listDated(from: number, to: number): Promise<Note[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<NoteRow>(
    "SELECT * FROM notes WHERE deleted = 0 AND status != 'trash' AND date_at >= ? AND date_at < ? ORDER BY date_at, edited_at DESC",
    [from, to],
  );
  return rows.map(toNote);
}

export async function getNote(id: string): Promise<Note | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<NoteRow>('SELECT * FROM notes WHERE id = ? AND deleted = 0', [id]);
  return row ? toNote(row) : null;
}

// Everything (for export), including archived and trash
export async function allNotes(): Promise<Note[]> {
  const db = await getDb();
  return (await db.getAllAsync<NoteRow>('SELECT * FROM notes WHERE deleted = 0 ORDER BY created_at')).map(toNote);
}

export async function colorCounts(status: NoteStatus): Promise<Map<number, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ color: number; n: number }>(
    'SELECT color, COUNT(*) AS n FROM notes WHERE deleted = 0 AND status = ? AND color IS NOT NULL GROUP BY color',
    [status],
  );
  return new Map(rows.map((r) => [r.color, r.n]));
}

export async function labelCounts(status: NoteStatus): Promise<Map<string, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; n: number }>(
    'SELECT j.value AS id, COUNT(*) AS n FROM notes, json_each(notes.labels) j WHERE deleted = 0 AND status = ? GROUP BY j.value',
    [status],
  );
  return new Map(rows.map((r) => [r.id, r.n]));
}

// Custom names for the 9 colours, e.g. Green = "Study". Synced across devices.
export async function getColorNames(): Promise<(string | null)[]> {
  const raw = await getMeta('color.names');
  return raw ? (JSON.parse(raw) as (string | null)[]) : Array(9).fill(null);
}

export async function setColorName(index: number, name: string | null) {
  const names = await getColorNames();
  names[index] = name?.trim() || null;
  await setMeta('color.names', JSON.stringify(names), true);
  emitChange();
}

export async function countByStatus(): Promise<Record<NoteStatus, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ status: NoteStatus; n: number }>(
    'SELECT status, COUNT(*) AS n FROM notes WHERE deleted = 0 GROUP BY status',
  );
  const out = { active: 0, archived: 0, trash: 0 };
  rows.forEach((r) => (out[r.status] = r.n));
  return out;
}

// --- Writes ---
export function newId() {
  return Crypto.randomUUID();
}

export function blankNote(kind: NoteKind, color: ColorIndex | null = null): Note {
  const now = Date.now();
  return {
    id: newId(), title: '', body: '', kind, items: [], color, labels: [], status: 'active',
    pinned: false, locked: false, cipher: null, format: 'plain', dateAt: null,
    createdAt: now, editedAt: now, updatedAt: now, seen: true,
  };
}

// Save a note locally and mark it for sync.
// touch=false keeps updatedAt (import, sync merges). editedAt is always taken from the note itself.
export async function saveNote(n: Note, opts: { touch?: boolean; dirty?: boolean; silent?: boolean } = {}) {
  const db = await getDb();
  const updatedAt = opts.touch === false ? n.updatedAt : Math.max(Date.now(), n.updatedAt + 1);
  await db.runAsync(
    `INSERT INTO notes (id, title, body, kind, items, color, labels, status, pinned, locked, cipher, format, date_at,
       created_at, edited_at, updated_at, deleted, search, dirty, seen)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET title=excluded.title, body=excluded.body, kind=excluded.kind,
       items=excluded.items, color=excluded.color, labels=excluded.labels, status=excluded.status,
       pinned=excluded.pinned, locked=excluded.locked, cipher=excluded.cipher, format=excluded.format,
       date_at=excluded.date_at, edited_at=excluded.edited_at,
       updated_at=excluded.updated_at, deleted=0, search=excluded.search, dirty=excluded.dirty, seen=excluded.seen`,
    [
      n.id, n.title, n.locked ? '' : n.body, n.kind, JSON.stringify(n.locked ? [] : n.items), n.color,
      JSON.stringify(n.labels), n.status, n.pinned ? 1 : 0, n.locked ? 1 : 0, n.cipher, n.format, n.dateAt,
      n.createdAt, n.editedAt, updatedAt, searchTextFor(n), opts.dirty === false ? 0 : 1, n.seen ? 1 : 0,
    ],
  );
  if (!opts.silent) emitChange();
  return { ...n, updatedAt };
}

// Moving between Notes / Archive / Trash doesn't count as editing the words
export async function setStatus(ids: string[], status: NoteStatus) {
  const db = await getDb();
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    for (const id of ids) {
      await db.runAsync('UPDATE notes SET status = ?, updated_at = MAX(?, updated_at + 1), dirty = 1 WHERE id = ?', [status, now, id]);
    }
  });
  emitChange();
}

export async function setPinned(ids: string[], pinned: boolean) {
  const db = await getDb();
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    for (const id of ids) {
      await db.runAsync('UPDATE notes SET pinned = ?, updated_at = MAX(?, updated_at + 1), dirty = 1 WHERE id = ?', [pinned ? 1 : 0, now, id]);
    }
  });
  emitChange();
}

// Permanent delete keeps a tombstone so other devices learn about it
export async function deleteForever(ids: string[]) {
  const db = await getDb();
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    for (const id of ids) {
      await db.runAsync(
        "UPDATE notes SET deleted = 1, title = '', body = '', items = '[]', cipher = NULL, search = '', updated_at = MAX(?, updated_at + 1), dirty = 1 WHERE id = ?",
        [now, id],
      );
    }
  });
  emitChange();
}

export async function markSeen(id: string) {
  const db = await getDb();
  await db.runAsync('UPDATE notes SET seen = 1 WHERE id = ?', [id]);
}

// --- Labels ---
export async function listLabels(): Promise<Label[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; name: string; updated_at: number }>(
    'SELECT id, name, updated_at FROM labels WHERE deleted = 0 ORDER BY name COLLATE NOCASE',
  );
  return rows.map((r) => ({ id: r.id, name: r.name, updatedAt: r.updated_at }));
}

export async function saveLabel(name: string, id = newId()) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO labels (id, name, updated_at, deleted, dirty) VALUES (?, ?, ?, 0, 1)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at, deleted = 0, dirty = 1`,
    [id, name.trim(), Date.now()],
  );
  emitChange();
  return id;
}

export async function deleteLabel(id: string) {
  const db = await getDb();
  await db.runAsync('UPDATE labels SET deleted = 1, updated_at = ?, dirty = 1 WHERE id = ?', [Date.now(), id]);
  emitChange();
}

// --- Meta (small settings, some synced) ---
export async function getMeta(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', [key]);
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string, sync = false) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO meta (key, value, updated_at, dirty) VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, dirty = excluded.dirty`,
    [key, value, Date.now(), sync ? 1 : 0],
  );
}
