import { FlexWidget, ListWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

import type { Note } from '@/db/types';
import { shortDate } from '@/lib/dates';
import { firstLine, isRTL } from '@/lib/text';

// --- Home-screen widgets, drawn in the app's timetable style ---
// Widget colours are plain hex; they follow the app's light/dark palette and colour bands.

export type WidgetPalette = {
  shell: `#${string}`; onShell: `#${string}`; onShellMuted: `#${string}`;
  ground: `#${string}`; ink: `#${string}`; inkMuted: `#${string}`; rule: `#${string}`; primary: `#${string}`; goldInk: `#${string}`;
  inks: `#${string}`[];
};

const icon = (path: string, color: string, size = 24) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"><path fill="${color}" d="${path}"/></svg>`;
const PLUS = 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z';
const BOX = 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z';
const TICK = 'M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2V5c0-1.1-.89-2-2-2zm-9 14-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z';
const LOCK = 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z';

const band = (n: Note, p: WidgetPalette) => (n.color === null ? p.ground : p.inks[n.color]);
const titleOf = (n: Note) => n.title || (n.kind === 'checklist' ? n.items[0]?.text : firstLine(n.body)) || 'Untitled';

function Header({ title, sub, p, newUri }: { title: string; sub?: string; p: WidgetPalette; newUri: string }) {
  return (
    <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: p.shell, paddingLeft: 16, paddingRight: 4, height: 52, width: 'match_parent' }}>
      <FlexWidget clickAction="OPEN_APP" style={{ flex: 1, flexDirection: 'column' }}>
        <TextWidget text={title} maxLines={1} truncate="END" style={{ fontSize: 16, fontWeight: '700', color: p.onShell }} />
        {sub ? <TextWidget text={sub} maxLines={1} style={{ fontSize: 12, color: p.onShellMuted }} /> : <FlexWidget style={{ height: 0 }} />}
      </FlexWidget>
      <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: newUri }} accessibilityLabel="New" style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
        <SvgWidget svg={icon(PLUS, p.onShell)} style={{ width: 24, height: 24 }} />
      </FlexWidget>
    </FlexWidget>
  );
}

// Pinned notes (or the most recent ones when nothing is pinned)
export function PinnedWidget({ notes, pinnedOnly, p }: { notes: Note[]; pinnedOnly: boolean; p: WidgetPalette }) {
  return (
    <FlexWidget style={{ height: 'match_parent', width: 'match_parent', backgroundColor: p.ground, borderRadius: 20, flexDirection: 'column' }}>
      <Header title={pinnedOnly ? 'Pinned' : 'Recent notes'} sub="Daftar" p={p} newUri="daftar://note/new?kind=text" />
      {notes.length === 0 ? (
        <FlexWidget clickAction="OPEN_APP" style={{ flex: 1, width: 'match_parent', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <TextWidget text="Pin a note in Daftar to keep it here." style={{ fontSize: 14, color: p.inkMuted }} />
        </FlexWidget>
      ) : (
        <ListWidget style={{ height: 'match_parent', width: 'match_parent' }}>
          {notes.map((n) => {
            const done = n.items.filter((i) => i.done).length;
            const title = titleOf(n);
            return (
              <FlexWidget
                key={n.id}
                clickAction="OPEN_URI"
                clickActionData={{ uri: `daftar://note/${n.id}` }}
                style={{ flexDirection: 'row', width: 'match_parent', borderBottomWidth: 1, borderBottomColor: p.rule }}>
                <FlexWidget style={{ width: 5, height: 'match_parent', backgroundColor: band(n, p) }} />
                <FlexWidget style={{ flex: 1, flexDirection: 'column', paddingHorizontal: 14, paddingVertical: 12 }}>
                  <TextWidget
                    text={title}
                    maxLines={1}
                    truncate="END"
                    style={{ fontSize: 16, fontWeight: '500', color: p.ink, textAlign: isRTL(title) ? 'right' : 'left' }}
                  />
                  <TextWidget
                    text={n.locked ? 'Locked' : n.kind === 'checklist' ? `${done} of ${n.items.length} ticked` : shortDate(n.editedAt)}
                    style={{ fontSize: 12, color: p.inkMuted }}
                  />
                </FlexWidget>
              </FlexWidget>
            );
          })}
        </ListWidget>
      )}
    </FlexWidget>
  );
}

// One note or list. Checklist items can be ticked right on the home screen.
export function SingleNoteWidget({ note, p, rows }: { note: Note | null; p: WidgetPalette; rows: number }) {
  if (!note) {
    return (
      <FlexWidget clickAction="OPEN_APP" style={{ height: 'match_parent', width: 'match_parent', backgroundColor: p.ground, borderRadius: 20, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <TextWidget text="This note was deleted. Hold the widget and choose another." style={{ fontSize: 14, color: p.inkMuted, textAlign: 'center' }} />
      </FlexWidget>
    );
  }
  const title = titleOf(note);
  const open = note.items.filter((i) => !i.done);
  const done = note.items.filter((i) => i.done);
  return (
    <FlexWidget style={{ height: 'match_parent', width: 'match_parent', backgroundColor: p.ground, borderRadius: 20, flexDirection: 'row' }}>
      <FlexWidget style={{ width: 6, height: 'match_parent', backgroundColor: band(note, p) }} />
      <FlexWidget style={{ flex: 1, flexDirection: 'column', height: 'match_parent' }}>
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: `daftar://note/${note.id}` }} style={{ width: 'match_parent', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
          {note.locked ? <SvgWidget svg={icon(LOCK, p.inkMuted, 16)} style={{ width: 16, height: 16, marginRight: 6 }} /> : <FlexWidget style={{ width: 0 }} />}
          <TextWidget text={title} maxLines={2} truncate="END" style={{ fontSize: 17, fontWeight: '700', color: p.ink, textAlign: isRTL(title) ? 'right' : 'left' }} />
        </FlexWidget>
        {note.locked ? (
          <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: `daftar://note/${note.id}` }} style={{ flex: 1, width: 'match_parent', paddingHorizontal: 14 }}>
            <TextWidget text="Locked. Tap to open with your fingerprint." style={{ fontSize: 14, color: p.inkMuted }} />
          </FlexWidget>
        ) : note.kind === 'checklist' ? (
          <ListWidget style={{ height: 'match_parent', width: 'match_parent' }}>
            {[...open, ...done].slice(0, 60).map((it) => (
              <FlexWidget
                key={it.id}
                clickAction="TOGGLE_ITEM"
                clickActionData={{ noteId: note.id, itemId: it.id }}
                accessibilityLabel={`${it.done ? 'Untick' : 'Tick'} ${it.text}`}
                style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent', paddingHorizontal: 10, paddingVertical: 8 }}>
                <SvgWidget svg={icon(it.done ? TICK : BOX, it.done ? p.primary : p.inkMuted, 22)} style={{ width: 22, height: 22, marginRight: 10 }} />
                <TextWidget
                  text={it.text || ' '}
                  maxLines={2}
                  truncate="END"
                  style={{ fontSize: 15, color: it.done ? p.inkMuted : p.ink, textAlign: isRTL(it.text) ? 'right' : 'left' }}
                />
              </FlexWidget>
            ))}
          </ListWidget>
        ) : (
          <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: `daftar://note/${note.id}` }} style={{ flex: 1, width: 'match_parent', paddingHorizontal: 14, paddingBottom: 12 }}>
            <TextWidget
              text={note.body.slice(0, 1200)}
              maxLines={Math.max(2, rows)}
              truncate="END"
              style={{ fontSize: 15, lineHeight: 21, color: p.ink, textAlign: isRTL(note.body) ? 'right' : 'left' }}
            />
          </FlexWidget>
        )}
      </FlexWidget>
    </FlexWidget>
  );
}

// Shown in the widget picker and while choosing a note
export function ChooseNotePlaceholder({ p }: { p: WidgetPalette }) {
  return (
    <FlexWidget style={{ height: 'match_parent', width: 'match_parent', backgroundColor: p.ground, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
      <TextWidget text="Choose a note…" style={{ fontSize: 14, color: p.inkMuted }} />
    </FlexWidget>
  );
}
