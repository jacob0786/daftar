import { View } from 'react-native';

import { NoteList } from '@/components/NoteList';
import { ShellHeader } from '@/components/ShellHeader';
import { StatusScrim } from '@/components/StatusScrim';
import { setStatus } from '@/db/database';
import { useNotes } from '@/hooks/useNotes';
import { syncSoon } from '@/sync/scheduler';

export default function ArchiveScreen() {
  const notes = useNotes({ status: 'archived' });
  return (
    <View style={{ flex: 1 }}>
      <NoteList
        notes={notes}
        header={<ShellHeader title="Archive" sub={notes ? `${notes.length} notes kept out of the way` : ' '} />}
        footerSpace={24}
        actions={[
          {
            icon: 'archive-arrow-up-outline',
            label: 'Unarchive',
            run: async (ids) => {
              await setStatus(ids, 'active');
              syncSoon();
              return { text: `${ids.length} back in Notes`, action: { label: 'Undo', run: () => setStatus(ids, 'archived') } };
            },
          },
          {
            icon: 'delete-outline',
            label: 'Move to trash',
            run: async (ids) => {
              await setStatus(ids, 'trash');
              syncSoon();
              return { text: `${ids.length} moved to trash`, action: { label: 'Undo', run: () => setStatus(ids, 'archived') } };
            },
          },
        ]}
        empty={{ icon: 'archive-outline', title: 'Archive is empty', body: 'Long-press a note in Notes and choose Archive to keep it without the clutter.' }}
      />
      <StatusScrim />
    </View>
  );
}
