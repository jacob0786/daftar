import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Dialog } from '@/components/Dialog';
import { NoteList } from '@/components/NoteList';
import { ShellHeader } from '@/components/ShellHeader';
import { StatusScrim } from '@/components/StatusScrim';
import { deleteForever, setStatus } from '@/db/database';
import { useNotes } from '@/hooks/useNotes';
import { syncSoon } from '@/sync/scheduler';
import { space, type, useTheme } from '@/theme';

export default function TrashScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const notes = useNotes({ status: 'trash' });
  const [confirm, setConfirm] = useState<string[] | null>(null);

  return (
    <View style={{ flex: 1 }}>
      <NoteList
        notes={notes}
        header={
          <ShellHeader
            title="Trash"
            onBack={() => router.back()}
            sub={notes ? `${notes.length} notes · restore any time` : ' '}
            right={
              notes?.length ? (
                <Pressable
                  onPress={() => setConfirm(notes.map((n) => n.id))}
                  accessibilityRole="button"
                  hitSlop={8}
                  style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: space(2) }}>
                  <Text style={[type.label, { color: c.onShell }]}>Empty trash</Text>
                </Pressable>
              ) : null
            }
          />
        }
        footerSpace={24}
        // Swipe right to restore (no swipe for delete-forever: that always asks first)
        swipeRight={{
          icon: 'restore',
          label: 'Restore',
          color: 'primary',
          run: async (ids) => {
            await setStatus(ids, 'active');
            syncSoon();
            return { text: 'Restored to Notes', action: { label: 'Undo', run: () => setStatus(ids, 'trash') } };
          },
        }}
        actions={[
          {
            icon: 'restore',
            label: 'Restore',
            run: async (ids) => {
              await setStatus(ids, 'active');
              syncSoon();
              return { text: `${ids.length} restored to Notes`, action: { label: 'Undo', run: () => setStatus(ids, 'trash') } };
            },
          },
          { icon: 'delete-forever-outline', label: 'Delete forever', run: async (ids) => setConfirm(ids) },
        ]}
        empty={{ icon: 'delete-empty-outline', title: 'Trash is empty', body: 'Deleted notes wait here until you delete them for good.' }}
      />

      <Dialog
        visible={!!confirm}
        title={`Delete ${confirm?.length ?? 0} ${confirm?.length === 1 ? 'note' : 'notes'} forever?`}
        body="They'll be removed from this device and from your Turso copy. This can't be undone."
        onDismiss={() => setConfirm(null)}
        buttons={[
          { label: 'Cancel', onPress: () => setConfirm(null) },
          {
            label: 'Delete forever',
            tone: 'danger',
            onPress: async () => {
              const ids = confirm ?? [];
              setConfirm(null);
              await deleteForever(ids);
              syncSoon();
            },
          },
        ]}
      />
      <StatusScrim />
    </View>
  );
}
