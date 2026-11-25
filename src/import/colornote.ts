import { readTextFile } from '@/lib/readFile';

import { emitChange, getDb, newId, saveLabel, saveNote } from '@/db/database';
import type { ColorIndex, Note, NoteStatus } from '@/db/types';
import { encryptContent, isUnlocked } from '@/lib/vault';

// Shape written by colornote-import/decrypt.py
type Exported = {
  id: string;
  title: string;
  type: 'text' | 'checklist';
  body: string | null;
  items: { text: string; done: boolean }[] | null;
  color: string | null;
  status: NoteStatus;
  locked: boolean;
  still_encrypted?: boolean;
  created: string | null;
  modified: string | null;
  labels?: string[]; // label names, added by the tidy step
};

// Same name -> same id on every device, so re-importing never duplicates labels
const labelId = (name: string) => `lbl:${name}`;

const COLOR_ORDER = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'black', 'grey', 'white'];

export type ImportPreview = { total: number; text: number; lists: number; archived: number; trash: number; locked: number; unreadable: number };

export async function readExport(uri: string): Promise<Exported[]> {
  const raw = await readTextFile(uri);
  const data = JSON.parse(raw);
  if (!Array.isArray(data) || (data.length && !('status' in data[0] && 'type' in data[0]))) {
    throw new Error("This doesn't look like a ColorNote export. Pick colornote-notes.json.");
  }
  return data as Exported[];
}

export function preview(notes: Exported[]): ImportPreview {
  return {
    total: notes.length,
    text: notes.filter((n) => n.type === 'text').length,
    lists: notes.filter((n) => n.type === 'checklist').length,
    archived: notes.filter((n) => n.status === 'archived').length,
    trash: notes.filter((n) => n.status === 'trash').length,
    locked: notes.filter((n) => n.locked).length,
    unreadable: notes.filter((n) => n.still_encrypted).length,
  };
}

function toNote(e: Exported): Note {
  const created = e.created ? Date.parse(e.created) : Date.now();
  const updated = e.modified ? Date.parse(e.modified) : created;
  const colorIdx = e.color ? COLOR_ORDER.indexOf(e.color) : -1;
  return {
    id: e.id || newId(),
    title: e.title ?? '',
    body: e.type === 'text' ? e.body ?? '' : '',
    kind: e.type === 'checklist' ? 'checklist' : 'text',
    items: e.type === 'checklist' ? (e.items ?? []).map((i) => ({ id: newId(), text: i.text, done: i.done })) : [],
    color: colorIdx >= 0 ? (colorIdx as ColorIndex) : null,
    labels: (e.labels ?? []).map(labelId),
    status: e.status,
    pinned: false,
    locked: false,
    cipher: null,
    format: 'plain',
    dateAt: null,
    createdAt: created,
    editedAt: updated,
    updatedAt: updated,
    seen: true,
  };
}

// Import everything in one transaction. Locked notes are encrypted with the vault key.
export async function importNotes(notes: Exported[], onProgress?: (done: number) => void) {
  const needsVault = notes.some((n) => n.locked && !n.still_encrypted);
  if (needsVault && !isUnlocked()) throw new Error('Set up and unlock locking first, so your 30 locked notes stay locked.');

  // Create every label the export mentions
  const names = [...new Set(notes.flatMap((n) => n.labels ?? []))];
  for (const name of names) await saveLabel(name, labelId(name));

  const db = await getDb();
  let done = 0;
  await db.withTransactionAsync(async () => {
    for (const e of notes) {
      if (e.still_encrypted) continue;
      let n = toNote(e);
      if (e.locked) {
        n = { ...n, locked: true, cipher: await encryptContent({ body: n.body, items: n.items }) };
      }
      await saveNote(n, { touch: false, silent: true });
      done += 1;
      if (done % 50 === 0) onProgress?.(done);
    }
  });
  emitChange();
  return done;
}
