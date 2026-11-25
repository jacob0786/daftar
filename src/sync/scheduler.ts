import { getMeta } from '@/db/database';
import { refreshWidgets } from '@/widgets/refresh';
import { getCredentials, syncNow } from './turso';

// --- Sync status shared with the header line ---
export type SyncState = { kind: 'off' } | { kind: 'syncing' } | { kind: 'ok'; at: number; conflicts?: number } | { kind: 'error'; message: string };

let state: SyncState = { kind: 'off' };
const listeners = new Set<(s: SyncState) => void>();

function set(s: SyncState) {
  state = s;
  listeners.forEach((fn) => fn(s));
}

export function getSyncState() {
  return state;
}

export function onSyncState(fn: (s: SyncState) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// Run a sync without blocking the UI; failures only update the status line
export async function syncInBackground() {
  if (!(await getCredentials())) return set({ kind: 'off' });
  if (state.kind === 'off' || state.kind === 'error') {
    const last = Number((await getMeta('sync.last')) ?? 0);
    if (last) set({ kind: 'ok', at: last });
  }
  set({ kind: 'syncing' });
  try {
    const r = await syncNow();
    set({ kind: 'ok', at: Date.now(), conflicts: r.conflicts });
    if (r.pulled) refreshWidgets();
  } catch (e) {
    set({ kind: 'error', message: e instanceof Error ? e.message : 'Sync failed.' });
  }
}

// After edits, wait a few seconds so typing doesn't trigger a sync per keystroke
let timer: ReturnType<typeof setTimeout> | null = null;
export function syncSoon() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    refreshWidgets();
    syncInBackground();
  }, 4000);
}
