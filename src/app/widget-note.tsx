import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { ShellHeader } from '@/components/ShellHeader';
import { StatusScrim } from '@/components/StatusScrim';
import { listNotes, setMeta } from '@/db/database';
import type { Note } from '@/db/types';
import { firstLine, isRTL } from '@/lib/text';
import { BAND, space, type, useTheme } from '@/theme';
import { refreshWidgets } from '@/widgets/refresh';

// Choose which note a home-screen "Note" widget shows. Opened by tapping the widget,
// so it works on launchers that skip Android's own widget setup screen (like Niagara).
export default function WidgetNoteScreen() {
  const { c, ink } = useTheme();
  const router = useRouter();
  const { widget } = useLocalSearchParams<{ widget?: string }>();
  const [notes, setNotes] = useState<Note[] | null>(null);

  useEffect(() => {
    listNotes({ status: 'active' }).then(setNotes);
  }, []);

  // Save the choice, redraw the widget, then go back to the home screen
  const pick = async (n: Note) => {
    if (!widget) return;
    await setMeta(`widget.${widget}`, n.id);
    await refreshWidgets();
    BackHandler.exitApp();
  };

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <View style={{ flex: 1, backgroundColor: c.ground }}>
      <FlatList
        data={notes ?? []}
        keyExtractor={(n) => n.id}
        ListHeaderComponent={<ShellHeader title="Choose a note" sub="It will show on your home-screen widget" onBack={leave} />}
        renderItem={({ item: n }) => {
          const title = n.title || (n.kind === 'checklist' ? n.items[0]?.text : firstLine(n.body)) || 'Untitled';
          const rtl = isRTL(title);
          return (
            <Pressable onPress={() => pick(n)} android_ripple={{ color: c.rule }} accessibilityRole="button" style={[styles.row, { borderBottomColor: c.rule }]}>
              <View style={{ width: BAND, alignSelf: 'stretch', backgroundColor: ink(n.color) }} />
              <Icon name={n.locked ? 'lock' : n.kind === 'checklist' ? 'format-list-checks' : 'text-long'} size={20} color={c.inkMuted} />
              <Text style={[type.rowTitle, { color: c.ink, flex: 1, textAlign: rtl ? 'right' : 'left', writingDirection: rtl ? 'rtl' : 'ltr' }]} numberOfLines={1}>{title}</Text>
            </Pressable>
          );
        }}
      />
      <StatusScrim />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: 60, paddingRight: space(4), borderBottomWidth: StyleSheet.hairlineWidth },
});
