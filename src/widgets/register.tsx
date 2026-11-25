import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { registerWidgetConfigurationScreen, registerWidgetTaskHandler, type WidgetConfigurationScreenProps } from 'react-native-android-widget';

import { getNote, listNotes, saveNote } from '@/db/database';
import type { Note } from '@/db/types';
import { getPrefs, loadPrefs } from '@/lib/prefs';
import { paletteFor, inksDark, inksLight } from '@/theme';
import { renderFor, setWidgetNoteId } from './render';

// --- Background handler: Android asks for a drawing, or a tap happened on a widget ---
registerWidgetTaskHandler(async ({ widgetInfo, widgetAction, clickAction, clickActionData, renderWidget }) => {
  console.log(`[widget] ${widgetAction} ${widgetInfo.widgetName} #${widgetInfo.widgetId}`);
  if (widgetAction === 'WIDGET_DELETED') return;
  if (widgetAction === 'WIDGET_CLICK' && clickAction === 'TOGGLE_ITEM') {
    // Tick or untick a checklist item straight from the home screen
    const { noteId, itemId } = clickActionData as { noteId: string; itemId: string };
    const n = await getNote(noteId);
    if (n && !n.locked) {
      await saveNote({ ...n, items: n.items.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)), editedAt: Date.now() }, { silent: true });
    }
  }
  try {
    renderWidget(await renderFor(widgetInfo));
  } catch (e) {
    console.warn('[widget] drawing failed', e);
  }
});

// --- Picking which note a "Note" widget shows ---
function ChooseNote({ widgetInfo, renderWidget, setResult }: WidgetConfigurationScreenProps) {
  const scheme = useColorScheme();
  const [notes, setNotes] = useState<Note[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    loadPrefs().then(async () => {
      setNotes(await listNotes({ status: 'active' }));
      setReady(true);
    });
  }, []);
  if (!ready) return <View style={{ flex: 1 }} />;
  const { c, isDark } = paletteFor(getPrefs(), scheme === 'dark');
  const inks = isDark ? inksDark : inksLight;

  const pick = async (n: Note) => {
    await setWidgetNoteId(widgetInfo.widgetId, n.id);
    renderWidget(await renderFor(widgetInfo));
    setResult('ok');
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.ground }}>
      <View style={[styles.head, { backgroundColor: c.shell }]}>
        <Text style={[styles.title, { color: c.onShell }]}>Choose a note for this widget</Text>
        <Pressable onPress={() => setResult('cancel')} style={styles.cancel} accessibilityRole="button">
          <Text style={{ color: c.onShellMuted, fontSize: 14, fontWeight: '500' }}>Cancel</Text>
        </Pressable>
      </View>
      <FlatList
        data={notes}
        keyExtractor={(n) => n.id}
        renderItem={({ item: n }) => (
          <Pressable onPress={() => pick(n)} android_ripple={{ color: c.rule }} style={[styles.row, { borderBottomColor: c.rule }]}>
            <View style={{ width: 6, alignSelf: 'stretch', backgroundColor: n.color === null ? 'transparent' : inks[n.color] }} />
            <Text style={[styles.rowText, { color: c.ink }]} numberOfLines={1}>
              {n.title || n.items[0]?.text || n.body.split('\n')[0] || 'Untitled'}
            </Text>
            <Text style={{ color: c.inkMuted, fontSize: 12, paddingRight: 16 }}>{n.kind === 'checklist' ? 'List' : n.locked ? 'Locked' : ''}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

registerWidgetConfigurationScreen(ChooseNote);

const styles = StyleSheet.create({
  head: { paddingTop: 48, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, fontSize: 20, fontWeight: '700' },
  cancel: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 60, gap: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  rowText: { flex: 1, fontSize: 17, fontWeight: '500' },
});
