import { useCallback, useEffect, useState } from 'react';

import { listLabels, listNotes, onNotesChanged, type ListFilter } from '@/db/database';
import type { Label, Note } from '@/db/types';
import { getSyncState, onSyncState, type SyncState } from '@/sync/scheduler';

// Notes for a filter, refreshed after any local write or sync
export function useNotes(filter: ListFilter) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const key = JSON.stringify(filter);

  const load = useCallback(() => {
    listNotes(JSON.parse(key)).then(setNotes);
  }, [key]);

  useEffect(() => {
    load();
    return onNotesChanged(load);
  }, [load]);

  return notes;
}

export function useLabels() {
  const [labels, setLabels] = useState<Label[]>([]);
  useEffect(() => {
    const load = () => listLabels().then(setLabels);
    load();
    return onNotesChanged(load);
  }, []);
  return labels;
}

export function useSyncState() {
  const [s, setS] = useState<SyncState>(getSyncState());
  useEffect(() => onSyncState(setS), []);
  return s;
}
