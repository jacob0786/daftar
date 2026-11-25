import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Note } from '@/db/types';
import { dayParts, sameDay, shortDate } from '@/lib/dates';
import { firstLine, isRTL } from '@/lib/text';
import { BAND, DAY_COL, space, type, useTheme } from '@/theme';
import { Icon } from './Icon';

type Props = {
  note: Note;
  selected: boolean;
  onPress: (n: Note) => void;
  onLongPress: (n: Note) => void;
};

// One timetable row: colour band | day column | title, with list progress for checklists
export const NoteRow = memo(function NoteRow({ note, selected, onPress, onLongPress }: Props) {
  const { c, ink, row, prefs } = useTheme();
  const today = sameDay(note.editedAt, Date.now());
  const { day, sub } = dayParts(note.editedAt);
  const timetable = prefs.view === 'timetable';

  const title = note.title || (note.kind === 'checklist' ? note.items[0]?.text : firstLine(note.body)) || 'Untitled';
  const done = note.items.filter((i) => i.done).length;
  const rtl = isRTL(title);

  // Today is a quiet wash across the row; the day number picks up the gold as text, never a block
  const rowBg = selected ? c.primaryContainer : today ? c.goldWash : c.ground;

  return (
    <Pressable
      onPress={() => onPress(note)}
      onLongPress={() => onLongPress(note)}
      android_ripple={{ color: c.rule }}
      accessibilityRole="button"
      accessibilityLabel={`${title}${note.locked ? ', locked' : ''}${note.kind === 'checklist' ? `, ${done} of ${note.items.length} ticked` : ''}`}
      style={[styles.row, { minHeight: row.min, backgroundColor: rowBg, borderBottomColor: c.rule }]}>
      <View style={{ width: BAND, backgroundColor: ink(note.color) }} />

      {timetable && (
        <View style={[styles.day, { borderRightColor: c.rule, paddingVertical: space(row.pad - 1) }]}>
          <Text style={[type.day, { color: today ? c.goldInk : c.ink }]}>{day}</Text>
          <Text style={[type.labelSmall, { color: today ? c.goldInk : c.inkMuted, textTransform: 'uppercase' }]} numberOfLines={1}>
            {sub}
          </Text>
        </View>
      )}

      <View style={[styles.text, { paddingVertical: space(row.pad) }]}>
        {!note.seen && <View style={[styles.lit, { backgroundColor: c.gold }]} />}
        <View style={styles.titleLine}>
          {note.locked && <Icon name="lock" size={16} color={c.inkMuted} />}
          <Text
            style={[type.rowTitle, { color: c.ink, flex: 1, textAlign: rtl ? 'right' : 'left', writingDirection: rtl ? 'rtl' : 'ltr' }]}
            numberOfLines={2}>
            {title}
          </Text>
          {note.pinned && <Icon name="pin" size={16} color={c.inkMuted} />}
          {!timetable && (
            <Text style={[type.labelSmall, { color: today ? c.goldInk : c.inkMuted, fontVariant: ['tabular-nums'] }]}>
              {today ? 'Today' : shortDate(note.editedAt)}
            </Text>
          )}
        </View>

        {(note.kind === 'checklist' && !note.locked) || note.dateAt ? (
          <View style={styles.meta}>
            {note.kind === 'checklist' && !note.locked ? (
              <>
                <Text style={[type.labelSmall, { color: c.inkMuted, fontVariant: ['tabular-nums'] }]}>
                  {done} of {note.items.length}
                </Text>
                <View style={[styles.track, { backgroundColor: c.rule }]}>
                  <View style={[styles.fill, { backgroundColor: c.primary, width: `${note.items.length ? (done / note.items.length) * 100 : 0}%` }]} />
                </View>
              </>
            ) : null}
            {note.dateAt ? (
              <View style={styles.dateTag}>
                <Icon name="calendar-blank-outline" size={14} color={c.inkMuted} />
                <Text style={[type.labelSmall, { color: c.inkMuted, fontVariant: ['tabular-nums'] }]}>{shortDate(note.dateAt)}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {selected && (
        <View style={styles.check}>
          <Icon name="check-circle" size={22} color={c.primary} />
        </View>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  day: { width: DAY_COL, alignItems: 'center', justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth },
  text: { flex: 1, paddingHorizontal: space(4), justifyContent: 'center', gap: space(1.5) },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  lit: { position: 'absolute', left: 0, top: space(3), bottom: space(3), width: 3, borderRadius: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  track: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden', maxWidth: 140 },
  fill: { height: 4, borderRadius: 2 },
  dateTag: { flexDirection: 'row', alignItems: 'center', gap: space(1) },
  check: { justifyContent: 'center', paddingRight: space(4) },
});
