import { View } from 'react-native';

import { NoteList, type BulkAction } from '@/components/NoteList';
import { ShellHeader } from '@/components/ShellHeader';
import { StatusScrim } from '@/components/StatusScrim';
import { setStatus } from '@/db/database';
import { useNotes } from '@/hooks/useNotes';
import { syncSoon } from '@/sync/scheduler';

// Unarchive / trash: used by the selection bar and by swiping a row
const unarchive: BulkAction = {
  icon: 'archive-arrow-up-outline',
  label: 'Unarchive',
  run: async (ids) => {
    await setStatus(ids, 'active');
    syncSoon();
    return { text: ids.length === 1 ? 'Back in Notes' : `${ids.length} back in Notes`, action: { label: 'Undo', run: () => setStatus(ids, 'archived') } };
  },
};
const trash: BulkAction = {
  icon: 'delete-outline',
  label: 'Move to trash',
  run: async (ids) => {
    await setStatus(ids, 'trash');
    syncSoon();
    return { text: ids.length === 1 ? 'Moved to trash' : `${ids.length} moved to trash`, action: { label: 'Undo', run: () => setStatus(ids, 'archived') } };
  },
};

export default function ArchiveScreen() {
  const notes = useNotes({ status: 'archived' });
  return (
    <View style={{ flex: 1 }}>
      <NoteList
        notes={notes}
        header={<ShellHeader title="Archive" sub={notes ? `${notes.length} notes kept out of the way` : ' '} />}
        footerSpace={24}
        swipeRight={{ ...unarchive, color: 'primary' }}
        swipeLeft={{ ...trash, color: 'danger' }}
        actions={[unarchive, trash]}
        empty={{ icon: 'archive-outline', title: 'Archive is empty', body: 'Swipe a note right in Notes, or long-press it and choose Archive, to keep it without the clutter.' }}
      />
      <StatusScrim />
    </View>
  );
}
