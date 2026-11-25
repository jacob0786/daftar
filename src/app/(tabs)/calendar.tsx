import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Fab } from '@/components/Fab';
import { Icon } from '@/components/Icon';
import { dayKey, MonthGrid } from '@/components/MonthGrid';
import { ShellHeader } from '@/components/ShellHeader';
import { StatusScrim } from '@/components/StatusScrim';
import { listDated, onNotesChanged } from '@/db/database';
import type { Note } from '@/db/types';
import { fullDate, hijri, sameDay, startOfDay } from '@/lib/dates';
import { available as phoneCalendar, askPermission, eventsBetween, hasPermission, openEvent, type PhoneEvent } from '@/lib/phoneCalendar';
import { BAND, space, type, useTheme } from '@/theme';

// Month view of notes by the date they're about, plus that day's phone calendar events
export default function CalendarScreen() {
  const { c, ink, prefs } = useTheme();
  const router = useRouter();
  const [month, setMonth] = useState(new Date());
  const [selected, setSelected] = useState(startOfDay(Date.now()));
  const [notes, setNotes] = useState<Note[]>([]);
  const [events, setEvents] = useState<PhoneEvent[]>([]);
  const [canRead, setCanRead] = useState(false);

  const from = new Date(month.getFullYear(), month.getMonth(), 1).getTime();
  const to = new Date(month.getFullYear(), month.getMonth() + 1, 1).getTime();

  // Notes dated this month, refreshed after any change
  useEffect(() => {
    const load = () => listDated(from, to).then(setNotes);
    load();
    return onNotesChanged(load);
  }, [from, to]);

  // Phone calendar events (only if you've allowed calendar access)
  const loadEvents = useCallback(async () => {
    const ok = await hasPermission();
    setCanRead(ok);
    setEvents(ok ? await eventsBetween(from, to, prefs.hiddenCalendars) : []);
  }, [from, to, prefs.hiddenCalendars]);
  useFocusEffect(useCallback(() => { loadEvents(); }, [loadEvents]));

  // Dots: note colours first, then a dot for days with events
  const marks = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const n of notes) {
      const k = dayKey(n.dateAt!);
      m.set(k, [...(m.get(k) ?? []), n.color === null ? 'transparent' : ink(n.color)]);
    }
    for (const e of events) {
      const k = dayKey(e.start);
      const list = m.get(k) ?? [];
      if (!list.includes(c.ruleStrong)) m.set(k, [...list, c.ruleStrong]);
    }
    return m;
  }, [notes, events, ink, c.ruleStrong]);

  const dayNotes = notes.filter((n) => sameDay(n.dateAt!, selected));
  const dayEvents = events.filter((e) => (e.allDay ? sameDay(e.start, selected) : startOfDay(e.start) <= selected && e.end > selected));
  const h = hijri(new Date(selected), prefs.hijriAdjust);

  return (
    <View style={{ flex: 1, backgroundColor: c.ground }}>
      <ScrollView contentContainerStyle={{ paddingBottom: space(28) }}>
        <ShellHeader title="Calendar" sub={`${notes.length} dated ${notes.length === 1 ? 'note' : 'notes'} this month`} />
        <MonthGrid
          month={month}
          selected={selected}
          marks={marks}
          onSelect={setSelected}
          onMonth={(d) => { setMonth(d); setSelected(startOfDay(d.getTime())); }}
        />

        <View style={[styles.dayHead, { backgroundColor: c.groundAlt, borderColor: c.rule }]}>
          <Text style={[type.labelSmall, styles.dayHeadText, { color: c.inkMuted }]}>{fullDate(selected)}</Text>
          {prefs.showHijri ? <Text style={[type.labelSmall, { color: c.inkMuted }]}>{h.english}</Text> : null}
        </View>

        {dayNotes.map((n) => (
          <Pressable
            key={n.id}
            onPress={() => router.push({ pathname: '/note/[id]', params: { id: n.id } })}
            android_ripple={{ color: c.rule }}
            accessibilityRole="button"
            style={[styles.item, { borderBottomColor: c.rule }]}>
            <View style={{ width: BAND, alignSelf: 'stretch', backgroundColor: ink(n.color) }} />
            <Icon name={n.locked ? 'lock' : n.kind === 'checklist' ? 'format-list-checks' : 'text-long'} size={20} color={c.inkMuted} />
            <Text style={[type.rowTitle, { color: c.ink, flex: 1 }]} numberOfLines={1}>{n.title || 'Untitled'}</Text>
          </Pressable>
        ))}

        {dayEvents.map((e) => (
          <Pressable key={e.id} onPress={() => openEvent(e.id)} android_ripple={{ color: c.rule }} accessibilityRole="button" style={[styles.item, { borderBottomColor: c.rule }]}>
            <View style={[styles.eventDot, { backgroundColor: e.color }]} />
            <Text style={[type.label, { color: c.inkMuted, minWidth: 48, fontVariant: ['tabular-nums'] }]}>{e.allDay ? 'All day' : time(e.start)}</Text>
            <Text style={[type.body, { color: c.ink, flex: 1 }]} numberOfLines={1}>{e.title}</Text>
          </Pressable>
        ))}

        {!dayNotes.length && !dayEvents.length ? (
          <Text style={[type.bodySmall, styles.empty, { color: c.inkMuted }]}>
            Nothing on this day. Give a note a date from its menu, or tap New.
          </Text>
        ) : null}

        {phoneCalendar && !canRead ? (
          <Pressable onPress={async () => { if (await askPermission()) loadEvents(); }} style={styles.permission} accessibilityRole="button">
            <Icon name="calendar-sync-outline" color={c.primary} />
            <Text style={[type.label, { color: c.primary, flex: 1 }]}>Show my Google Calendar events here</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <Fab
        onNote={() => router.push({ pathname: '/note/[id]', params: { id: 'new', kind: 'text', date: String(selected), color: prefs.defaultColor ?? '' } })}
        onList={() => router.push({ pathname: '/note/[id]', params: { id: 'new', kind: 'checklist', date: String(selected), color: prefs.defaultColor ?? '' } })}
        onEvent={() => router.push({ pathname: '/event', params: { date: String(selected) } })}
      />
      <StatusScrim />
    </View>
  );
}

function time(ms: number) {
  const d = new Date(ms);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space(4), paddingVertical: space(2), marginTop: space(2), borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  dayHeadText: { textTransform: 'uppercase', letterSpacing: 0.8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: 56, paddingRight: space(4), borderBottomWidth: StyleSheet.hairlineWidth },
  eventDot: { width: 10, height: 10, borderRadius: 5, marginLeft: space(4) },
  empty: { paddingHorizontal: space(5), paddingVertical: space(5) },
  permission: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(5), minHeight: 56 },
});
