import { readTextFile } from './readFile';

import { allNotes, emitChange, getColorNames, getDb, getMeta, listLabels, saveLabel, saveNote, setMeta } from '@/db/database';
import type { Note } from '@/db/types';
import { vaultParams } from './vault';

// --- Daftar backup file ---
// Everything in one JSON file. Locked notes stay encrypted inside it (only their titles are readable),
// and the lock's salt travels with it so the same passphrase opens them on any device.

export type Backup = {
  app: 'daftar';
  version: 1;
  exportedAt: string;
  vault: { salt: string; check: string } | null;
  colorNames: (string | null)[];
  labels: { id: string; name: string }[];
  notes: Omit<Note, 'seen'>[];
};

export async function buildBackup(): Promise<string> {
  const v = await vaultParams();
  const notes = (await allNotes()).map(({ seen: _seen, ...n }) => n);
  const backup: Backup = {
    app: 'daftar',
    version: 1,
    exportedAt: new Date().toISOString(),
    vault: v.salt && v.check ? { salt: v.salt, check: v.check } : null,
    colorNames: await getColorNames(),
    labels: (await listLabels()).map((l) => ({ id: l.id, name: l.name })),
    notes,
  };
  return JSON.stringify(backup);
}

export function backupFileName(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `daftar-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}

export async function readBackup(uri: string): Promise<Backup> {
  const data = JSON.parse(await readTextFile(uri));
  if (data?.app !== 'daftar' || !Array.isArray(data.notes)) throw new Error("This isn't a Daftar backup file.");
  return data as Backup;
}

// Bring a backup in. Notes that already exist are only replaced by a newer copy, so nothing newer is lost.
export async function restoreBackup(b: Backup, onProgress?: (n: number) => void): Promise<number> {
  const localSalt = await getMeta('vault.salt');
  const hasLocked = b.notes.some((n) => n.locked);
  if (hasLocked && b.vault) {
    if (!localSalt) {
      // This device has no lock yet: adopt the backup's, so the same passphrase opens its locked notes
      await setMeta('vault.salt', b.vault.salt, true);
      await setMeta('vault.check', b.vault.check, true);
    } else if (localSalt !== b.vault.salt) {
      throw new Error('The locked notes in this backup use a different lock passphrase from this device. Restore it on a device without a lock set up, or remove the lock here first.');
    }
  }

  for (const l of b.labels) await saveLabel(l.name, l.id);
  if (b.colorNames?.some(Boolean)) await setMeta('color.names', JSON.stringify(b.colorNames), true);

  const db = await getDb();
  let done = 0;
  await db.withTransactionAsync(async () => {
    for (const n of b.notes) {
      const existing = await db.getFirstAsync<{ updated_at: number }>('SELECT updated_at FROM notes WHERE id = ?', [n.id]);
      if (existing && existing.updated_at >= n.updatedAt) continue;
      await saveNote({ ...n, seen: true }, { touch: false, silent: true });
      done += 1;
      if (done % 50 === 0) onProgress?.(done);
    }
  });
  emitChange();
  return done;
}
