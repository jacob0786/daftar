import { emitChange, getDb, getMeta, newId, setMeta, toNote, type NoteRow } from '@/db/database';
import type { ChecklistItem } from '@/db/types';
import { secureDelete, secureGet, secureSet } from '@/lib/secure';
import { foldForSearch } from '@/lib/text';

// --- Credentials: typed in Settings, kept in the device's secure storage ---
const URL_KEY = 'turso.url';
const TOKEN_KEY = 'turso.token';

export async function getCredentials() {
  const url = await secureGet(URL_KEY);
  const token = await secureGet(TOKEN_KEY);
  return url && token ? { url, token } : null;
}

export async function saveCredentials(url: string, token: string) {
  await secureSet(URL_KEY, url.trim());
  await secureSet(TOKEN_KEY, token.trim());
}

export async function clearCredentials() {
  await secureDelete(URL_KEY);
  await secureDelete(TOKEN_KEY);
}

// Accept the address in any form people paste it:
// libsql://name-org.turso.io, https://..., or just name-org.turso.io -> https://name-org.turso.io
export function httpBase(url: string) {
  const host = url
    .replace(/\s+/g, '') // stray spaces or line breaks from copy-paste
    .replace(/^(libsql|wss?|https?):\/\//i, '') // drop whatever prefix was typed
    .replace(/\/.*$/, ''); // drop any path after the address
  return `https://${host}`;
}

// --- Minimal client for Turso's HTTP API (Hrana v2 pipeline) ---
type Value = string | number | null;
type Stmt = { sql: string; args?: Value[] };
type Rows = Record<string, Value>[] & { affected: number };

function encodeArg(v: Value) {
  if (v === null || v === undefined) return { type: 'null' };
  if (typeof v === 'number') return Number.isInteger(v) ? { type: 'integer', value: String(v) } : { type: 'float', value: v };
  return { type: 'text', value: v };
}

function decodeCell(c: { type: string; value?: string | number }): Value {
  if (c.type === 'null') return null;
  if (c.type === 'integer') return Number(c.value);
  if (c.type === 'float') return Number(c.value);
  return (c.value as string) ?? null;
}

async function pipeline(creds: { url: string; token: string }, stmts: Stmt[]): Promise<Rows[]> {
  let res: Response;
  try {
    res = await fetch(`${httpBase(creds.url)}/v2/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${creds.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          ...stmts.map((s) => ({ type: 'execute', stmt: { sql: s.sql, args: (s.args ?? []).map(encodeArg) } })),
          { type: 'close' },
        ],
      }),
    });
  } catch {
    throw new SyncError("Couldn't reach Turso. Check your connection and the database address.");
  }
  if (res.status === 401 || res.status === 403) throw new SyncError('Turso rejected the token. Check it in Settings.');
  if (!res.ok) throw new SyncError(`Turso returned ${res.status}.`);
  const json = await res.json();
  return (json.results as any[]).slice(0, stmts.length).map((r) => {
    if (r.type === 'error') throw new SyncError(r.error?.message ?? 'Turso query failed.');
    const result = r.response.result;
    const cols: string[] = result.cols.map((c: { name: string }) => c.name);
    const rows = (result.rows as any[][]).map((row) => Object.fromEntries(row.map((cell, i) => [cols[i], decodeCell(cell)]))) as Rows;
    rows.affected = Number(result.affected_row_count ?? 0);
    return rows;
  });
}

export class SyncError extends Error {}

// Server clock in ms, so pull order never depends on device clocks
const SERVER_NOW = "CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)";

const REMOTE_SCHEMA: Stmt[] = [
  { sql: `CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, title TEXT, body TEXT, kind TEXT, items TEXT,
      color INTEGER, labels TEXT, status TEXT, pinned INTEGER, locked INTEGER, cipher TEXT,
      created_at INTEGER, updated_at INTEGER, deleted INTEGER, synced_at INTEGER)` },
  { sql: 'CREATE INDEX IF NOT EXISTS notes_synced ON notes (synced_at)' },
  { sql: 'CREATE TABLE IF NOT EXISTS labels (id TEXT PRIMARY KEY, name TEXT, updated_at INTEGER, deleted INTEGER, synced_at INTEGER)' },
  { sql: 'CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER, synced_at INTEGER)' },
];
// Columns added in version 2. Each runs on its own: another device may have added it already.
const REMOTE_V2 = ['edited_at INTEGER', 'date_at INTEGER', 'format TEXT'];

const NOTE_COLS = ['id', 'title', 'body', 'kind', 'items', 'color', 'labels', 'status', 'pinned', 'locked', 'cipher',
  'format', 'date_at', 'created_at', 'edited_at', 'updated_at', 'deleted'];

// Newest version wins on the server: the row only changes when the incoming copy is newer
function upsertSql(table: string, cols: string[], key: string) {
  const sets = cols.filter((c) => c !== key).map((c) => `${c} = excluded.${c}`).join(', ');
  return `INSERT INTO ${table} (${cols.join(', ')}, synced_at) VALUES (${cols.map(() => '?').join(', ')}, ${SERVER_NOW})
    ON CONFLICT(${key}) DO UPDATE SET ${sets}, synced_at = ${SERVER_NOW} WHERE excluded.updated_at > ${table}.updated_at`;
}

// --- One full sync: pull first (so clashes are caught), then push local changes ---
let running: Promise<SyncResult> | null = null;
export type SyncResult = { pushed: number; pulled: number; conflicts: number };

export function syncNow(): Promise<SyncResult> {
  if (!running) running = doSync().finally(() => (running = null));
  return running;
}

async function ensureSchema(creds: { url: string; token: string }) {
  const v = await getMeta('sync.schema');
  if (v === '2') return;
  if (v !== '1') await pipeline(creds, REMOTE_SCHEMA);
  for (const col of REMOTE_V2) {
    await pipeline(creds, [{ sql: `ALTER TABLE notes ADD COLUMN ${col}` }]).catch(() => {}); // already there
  }
  await setMeta('sync.schema', '2');
}

async function doSync(): Promise<SyncResult> {
  const creds = await getCredentials();
  if (!creds) throw new SyncError('Add your Turso database in Settings to sync.');
  const db = await getDb();
  await ensureSchema(creds);

  // 1. Pull anything the server saw after our last pull (5 s overlap; applying is idempotent)
  let pulled = 0;
  let conflicts = 0;
  const since = Number((await getMeta('sync.cursor')) ?? '0');
  let cursor = since;
  for (;;) {
    const [rows, lbls, mts] = await pipeline(creds, [
      { sql: `SELECT ${NOTE_COLS.join(', ')}, synced_at FROM notes WHERE synced_at > ? ORDER BY synced_at LIMIT 300`, args: [cursor] },
      { sql: 'SELECT id, name, updated_at, deleted, synced_at FROM labels WHERE synced_at > ?', args: [since] },
      { sql: 'SELECT key, value, updated_at, synced_at FROM meta WHERE synced_at > ?', args: [since] },
    ]);
    await db.withTransactionAsync(async () => {
      for (const r of rows) {
        const outcome = await applyRemoteNote(r);
        if (outcome !== 'same') pulled += 1;
        if (outcome === 'conflict') conflicts += 1;
      }
      if (cursor === since) {
        for (const l of lbls) {
          await db.runAsync(
            `INSERT INTO labels (id, name, updated_at, deleted, dirty) VALUES (?, ?, ?, ?, 0)
             ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at, deleted = excluded.deleted
             WHERE excluded.updated_at > labels.updated_at`,
            [l.id, l.name, l.updated_at, l.deleted],
          );
        }
        for (const m of mts) {
          await db.runAsync(
            `INSERT INTO meta (key, value, updated_at, dirty) VALUES (?, ?, ?, 0)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
             WHERE excluded.updated_at > meta.updated_at`,
            [m.key, m.value, m.updated_at],
          );
        }
      }
    });
    if (rows.length) cursor = Number(rows[rows.length - 1].synced_at);
    if (rows.length < 300) break;
  }

  // 2. Push notes. If the server refused some (another device saved a newer copy a moment ago),
  //    fetch those, settle the clash the same way as a pull, and push once more.
  let { pushed, refused } = await pushNotes(creds);
  if (refused.length) {
    const [server] = await pipeline(creds, [
      { sql: `SELECT ${NOTE_COLS.join(', ')} FROM notes WHERE id IN (${refused.map(() => '?').join(', ')})`, args: refused },
    ]);
    await db.withTransactionAsync(async () => {
      for (const r of server) if ((await applyRemoteNote(r)) === 'conflict') conflicts += 1;
    });
    pulled += server.length;
    pushed += (await pushNotes(creds)).pushed;
  }

  // 3. Push labels and synced settings
  const labels = await db.getAllAsync<Record<string, Value>>('SELECT id, name, updated_at, deleted FROM labels WHERE dirty = 1');
  const metas = await db.getAllAsync<Record<string, Value>>('SELECT key, value, updated_at FROM meta WHERE dirty = 1');
  if (labels.length || metas.length) {
    await pipeline(creds, [
      ...labels.map((r) => ({ sql: upsertSql('labels', ['id', 'name', 'updated_at', 'deleted'], 'id'), args: [r.id, r.name, r.updated_at, r.deleted] })),
      ...metas.map((r) => ({ sql: upsertSql('meta', ['key', 'value', 'updated_at'], 'key'), args: [r.key, r.value, r.updated_at] })),
    ]);
    await db.runAsync('UPDATE labels SET dirty = 0 WHERE dirty = 1');
    await db.runAsync('UPDATE meta SET dirty = 0 WHERE dirty = 1');
  }

  await setMeta('sync.cursor', String(Math.max(since, cursor - 5000)));
  await setMeta('sync.last', String(Date.now()));
  if (pulled) emitChange();
  return { pushed, pulled, conflicts };
}

// Push every note waiting to sync, in batches of roughly 400 KB
async function pushNotes(creds: { url: string; token: string }) {
  const db = await getDb();
  let pushed = 0;
  const refused: string[] = [];
  const dirty = await db.getAllAsync<Record<string, Value>>(`SELECT ${NOTE_COLS.join(', ')} FROM notes WHERE dirty = 1`);
  const noteSql = upsertSql('notes', NOTE_COLS, 'id');
  for (let i = 0; i < dirty.length; ) {
    const batch: Record<string, Value>[] = [];
    let size = 0;
    while (i < dirty.length && (batch.length === 0 || size < 400_000)) {
      const row = dirty[i++];
      size += String(row.body ?? '').length + String(row.items ?? '').length + String(row.cipher ?? '').length;
      batch.push(row);
    }
    const results = await pipeline(creds, batch.map((r) => ({ sql: noteSql, args: NOTE_COLS.map((c) => r[c] as Value) })));
    for (let k = 0; k < batch.length; k++) {
      if (results[k].affected === 0) {
        refused.push(batch[k].id as string);
        continue;
      }
      await db.runAsync('UPDATE notes SET dirty = 0 WHERE id = ? AND updated_at = ?', [batch[k].id as string, batch[k].updated_at as number]);
      pushed += 1;
    }
  }
  return { pushed, refused };
}

// --- Applying one server row ---
// No local edits waiting: the newer copy wins.
// Local edits waiting AND the server changed too (both edited while apart):
//   - same words on both sides: keep the newer one, nothing lost
//   - two checklists: merge them, so items added on either device are all kept
//   - anything else: the newer version stays, the other is saved beside it as "(conflict copy)"
async function applyRemoteNote(r: Record<string, Value>): Promise<'same' | 'applied' | 'conflict'> {
  const db = await getDb();
  const local = await db.getFirstAsync<NoteRow>('SELECT * FROM notes WHERE id = ?', [r.id as string]);
  const remoteUpdated = Number(r.updated_at);

  if (!local) {
    await writeRemote(r, 0);
    return 'applied';
  }
  if (local.updated_at === remoteUpdated) {
    // The server already has this exact version
    if (local.dirty) await db.runAsync('UPDATE notes SET dirty = 0 WHERE id = ? AND updated_at = ?', [local.id, local.updated_at]);
    return 'same';
  }

  if (!local.dirty) {
    if (local.updated_at > remoteUpdated) return 'same';
    await writeRemote(r, 0);
    return 'applied';
  }

  // Both sides changed. Edits beat deletes.
  if (r.deleted && !local.deleted) {
    await db.runAsync('UPDATE notes SET updated_at = ? WHERE id = ?', [Math.max(local.updated_at, remoteUpdated) + 1, local.id]);
    return 'conflict';
  }
  if (local.deleted && !r.deleted) {
    await writeRemote(r, 0);
    return 'applied';
  }
  if (sameWords(local, r)) {
    if (remoteUpdated > local.updated_at) await writeRemote(r, 0);
    return 'same';
  }

  const remoteNewer = remoteUpdated > local.updated_at;
  const bump = Math.max(local.updated_at, remoteUpdated) + 1;

  // Two open checklists: merge items by id, newer side's wording and order first
  if (local.kind === 'checklist' && r.kind === 'checklist' && !local.locked && !r.locked) {
    const localItems = JSON.parse(local.items || '[]') as ChecklistItem[];
    const remoteItems = JSON.parse((r.items as string) || '[]') as ChecklistItem[];
    const [first, second] = remoteNewer ? [remoteItems, localItems] : [localItems, remoteItems];
    const ids = new Set(first.map((i) => i.id));
    const merged = [...first, ...second.filter((i) => !ids.has(i.id))];
    const base = remoteNewer ? { ...rowFromRemote(r) } : { ...local };
    await writeRow({ ...base, items: JSON.stringify(merged), updated_at: bump, edited_at: Math.max(local.edited_at, Number(r.edited_at ?? 0)) }, 1, 0);
    return 'conflict';
  }

  // Keep the newer as the note; save the older beside it so nothing is lost
  const older = remoteNewer ? { ...local } : rowFromRemote(r);
  if (remoteNewer) await writeRemote(r, 0);
  else await db.runAsync('UPDATE notes SET updated_at = ? WHERE id = ?', [bump, local.id]);
  const now = Date.now();
  await writeRow(
    { ...older, id: newId(), title: `${older.title || 'Untitled'} (conflict copy)`, created_at: now, updated_at: now, deleted: 0 },
    1,
    0,
  );
  return 'conflict';
}

function sameWords(local: NoteRow, r: Record<string, Value>) {
  return local.title === (r.title ?? '') && local.body === (r.body ?? '') && local.items === (r.items ?? '[]')
    && (local.cipher ?? null) === (r.cipher ?? null) && local.kind === r.kind && !!local.deleted === !!r.deleted;
}

// Server row -> local row shape (older app versions don't send the newer columns)
function rowFromRemote(r: Record<string, Value>): NoteRow {
  return {
    id: r.id as string, title: (r.title as string) ?? '', body: (r.body as string) ?? '', kind: (r.kind as string) ?? 'text',
    items: (r.items as string) || '[]', color: (r.color as number | null) ?? null, labels: (r.labels as string) || '[]',
    status: (r.status as string) ?? 'active', pinned: Number(r.pinned ?? 0), locked: Number(r.locked ?? 0),
    cipher: (r.cipher as string | null) ?? null, format: (r.format as string) || 'plain', date_at: (r.date_at as number | null) ?? null,
    created_at: Number(r.created_at), edited_at: Number(r.edited_at ?? r.updated_at), updated_at: Number(r.updated_at),
    deleted: Number(r.deleted ?? 0), seen: 0, dirty: 0,
  };
}

async function writeRemote(r: Record<string, Value>, dirty: 0 | 1) {
  await writeRow(rowFromRemote(r), dirty, 0);
}

async function writeRow(row: NoteRow, dirty: 0 | 1, seen: 0 | 1) {
  const db = await getDb();
  const n = toNote(row);
  const search = row.deleted ? '' : foldForSearch(`${n.title}\n${n.locked ? '' : [n.body, ...n.items.map((i) => i.text)].join('\n')}`);
  await db.runAsync(
    `INSERT INTO notes (${NOTE_COLS.join(', ')}, search, dirty, seen) VALUES (${NOTE_COLS.map(() => '?').join(', ')}, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET ${NOTE_COLS.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`).join(', ')},
       search = excluded.search, dirty = excluded.dirty, seen = excluded.seen`,
    [...NOTE_COLS.map((c) => (row as unknown as Record<string, Value>)[c] ?? null), search, dirty, seen],
  );
}

// Quick check used by the Settings screen before saving credentials
export async function testConnection(url: string, token: string) {
  await pipeline({ url, token }, [{ sql: 'SELECT 1' }]);
}
