'use no memo'; // see NoteWidgets.tsx
import type { WidgetInfo, WidgetRepresentation } from 'react-native-android-widget';

import { getDb, getMeta, getNote, setMeta, toNote, type NoteRow } from '@/db/database';
import type { Note } from '@/db/types';
import { getPrefs, loadPrefs } from '@/lib/prefs';
import { inksDark, inksLight, paletteFor } from '@/theme';
import { ChooseNotePlaceholder, PinnedWidget, SingleNoteWidget, type WidgetPalette } from './NoteWidgets';

export const PINNED = 'DaftarPinned';
export const SINGLE = 'DaftarNote';

// Light and dark versions follow the app's theme and accent
async function palettes(): Promise<{ light: WidgetPalette; dark: WidgetPalette }> {
  await loadPrefs();
  const make = (dark: boolean): WidgetPalette => {
    const { c, isDark } = paletteFor(getPrefs(), dark);
    return { ...(c as unknown as WidgetPalette), inks: (isDark ? inksDark : inksLight) as `#${string}`[] };
  };
  return { light: make(false), dark: make(true) };
}

async function pinnedNotes(limit: number): Promise<{ notes: Note[]; pinnedOnly: boolean }> {
  const db = await getDb();
  const pinned = await db.getAllAsync<NoteRow>(
    "SELECT * FROM notes WHERE deleted = 0 AND status = 'active' AND pinned = 1 ORDER BY edited_at DESC LIMIT ?",
    [limit],
  );
  if (pinned.length) return { notes: pinned.map(toNote), pinnedOnly: true };
  const recent = await db.getAllAsync<NoteRow>("SELECT * FROM notes WHERE deleted = 0 AND status = 'active' ORDER BY edited_at DESC LIMIT ?", [limit]);
  return { notes: recent.map(toNote), pinnedOnly: false };
}

// Which note each single-note widget shows (kept on this phone)
export async function widgetNoteId(widgetId: number) {
  return getMeta(`widget.${widgetId}`);
}
export async function setWidgetNoteId(widgetId: number, noteId: string) {
  await setMeta(`widget.${widgetId}`, noteId);
}

export async function renderFor(info: WidgetInfo): Promise<WidgetRepresentation> {
  const p = await palettes();
  if (info.widgetName === PINNED) {
    const { notes, pinnedOnly } = await pinnedNotes(30);
    return {
      light: <PinnedWidget notes={notes} pinnedOnly={pinnedOnly} p={p.light} />,
      dark: <PinnedWidget notes={notes} pinnedOnly={pinnedOnly} p={p.dark} />,
    };
  }
  const id = await widgetNoteId(info.widgetId);
  if (!id) return { light: <ChooseNotePlaceholder p={p.light} widgetId={info.widgetId} />, dark: <ChooseNotePlaceholder p={p.dark} widgetId={info.widgetId} /> };
  const note = await getNote(id);
  const rows = Math.floor((info.height - 60) / 21);
  return {
    light: <SingleNoteWidget note={note} p={p.light} rows={rows} widgetId={info.widgetId} />,
    dark: <SingleNoteWidget note={note} p={p.dark} rows={rows} widgetId={info.widgetId} />,
  };
}
