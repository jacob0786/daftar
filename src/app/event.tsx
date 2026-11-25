import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DateSheet } from '@/components/DateSheet';
import { Sheet, SheetRow } from '@/components/FilterChips';
import { Icon, type IconName } from '@/components/Icon';
import { fullDate, startOfDay } from '@/lib/dates';
import { askPermission, createEvent, writableCalendars, type PhoneCalendar } from '@/lib/phoneCalendar';
import { space, type, useTheme } from '@/theme';

const REMINDERS: { label: string; minutes: number | null }[] = [
  { label: 'No reminder', minutes: null },
  { label: 'At the time', minutes: 0 },
  { label: '10 minutes before', minutes: 10 },
  { label: '30 minutes before', minutes: 30 },
  { label: '1 hour before', minutes: 60 },
  { label: '1 day before', minutes: 1440 },
];

// Add an event to your Google Calendar (through the phone's calendar). It is not saved as a note.
export default function NewEventScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ date?: string }>();

  const day0 = params.date ? Number(params.date) : startOfDay(Date.now());
  const nextHour = new Date();
  nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);

  const [title, setTitle] = useState('');
  const [day, setDay] = useState(day0);
  const [allDay, setAllDay] = useState(false);
  const [start, setStart] = useState({ h: nextHour.getHours(), m: 0 });
  const [length, setLength] = useState(60); // minutes
  const [reminder, setReminder] = useState<number | null>(30);
  const [notes, setNotes] = useState('');
  const [calendars, setCalendars] = useState<PhoneCalendar[]>([]);
  const [calendarId, setCalendarId] = useState<string | null>(null);
  const [picker, setPicker] = useState<'date' | 'time' | 'reminder' | 'calendar' | 'length' | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Ask for calendar access, then choose the main Google calendar by default
  useEffect(() => {
    (async () => {
      if (!(await askPermission())) return setError('Daftar needs calendar access to add events. Allow it in Android settings, then try again.');
      const list = await writableCalendars();
      setCalendars(list);
      setCalendarId(list[0]?.id ?? null);
      if (!list.length) setError('No calendar on this phone accepts new events. Add your Google account in Android settings.');
    })();
  }, []);

  const save = async () => {
    if (!calendarId) return;
    setSaving(true);
    try {
      const s = new Date(day);
      if (!allDay) s.setHours(start.h, start.m, 0, 0);
      const e = allDay ? new Date(day + 86_400_000) : new Date(s.getTime() + length * 60_000);
      await createEvent({ calendarId, title: title.trim() || 'Event', start: s, end: e, allDay, reminderMinutes: reminder, notes });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add the event.");
      setSaving(false);
    }
  };

  const cal = calendars.find((x) => x.id === calendarId);
  const lengthLabel = length < 60 ? `${length} min` : `${length / 60} h`.replace('.5 h', '½ h');

  return (
    <View style={[styles.fill, { backgroundColor: c.ground, paddingTop: insets.top }]}>
      <View style={[styles.bar, { borderBottomColor: c.rule }]}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Cancel">
          <Icon name="close" color={c.ink} />
        </Pressable>
        <Text style={[type.titleMedium, { color: c.ink, flex: 1 }]}>New calendar event</Text>
        <Pressable
          onPress={save}
          disabled={!calendarId || saving}
          style={[styles.save, { backgroundColor: c.primary, opacity: !calendarId || saving ? 0.45 : 1 }]}
          accessibilityRole="button">
          <Text style={[type.label, { color: c.onPrimary }]}>{saving ? 'Adding…' : 'Add'}</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior="padding" style={styles.fill}>
        <ScrollView contentContainerStyle={{ paddingBottom: space(10) }} keyboardShouldPersistTaps="handled">
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="What's happening?"
            placeholderTextColor={c.inkMuted}
            autoFocus
            selectionColor={c.primary}
            cursorColor={c.primary}
            style={[type.title, styles.title, { color: c.ink, borderBottomColor: c.rule }]}
          />

          <Row icon="calendar-blank-outline" label={fullDate(day)} onPress={() => setPicker('date')} />
          <View style={[styles.row, { borderBottomColor: c.rule }]}>
            <Icon name="weather-sunny" color={c.inkMuted} />
            <Text style={[type.body, { color: c.ink, flex: 1 }]}>All day</Text>
            <Switch value={allDay} onValueChange={setAllDay} trackColor={{ true: c.primary, false: c.ruleStrong }} thumbColor={allDay ? c.onPrimary : c.inkMuted} />
          </View>
          {!allDay && (
            <>
              <Row icon="clock-outline" label={`Starts ${start.h}:${String(start.m).padStart(2, '0')}`} onPress={() => setPicker('time')} />
              <Row icon="timer-outline" label={`Lasts ${lengthLabel}`} onPress={() => setPicker('length')} />
            </>
          )}
          <Row icon="bell-outline" label={REMINDERS.find((r) => r.minutes === reminder)?.label ?? 'Reminder'} onPress={() => setPicker('reminder')} />
          <Row icon="google" label={cal ? `${cal.title}${cal.account && cal.account !== cal.title ? ` · ${cal.account}` : ''}` : 'Choose calendar'} onPress={() => setPicker('calendar')} dot={cal?.color} />

          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Details (optional)"
            placeholderTextColor={c.inkMuted}
            multiline
            selectionColor={c.primary}
            cursorColor={c.primary}
            style={[type.body, styles.notes, { color: c.ink }]}
          />
          {error ? <Text style={[type.bodySmall, styles.error, { color: c.danger }]}>{error}</Text> : null}
          <Text style={[type.bodySmall, styles.error, { color: c.inkMuted }]}>
            Events go to your phone's calendar and sync to Google Calendar with their reminders. They aren't saved as notes.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <DateSheet visible={picker === 'date'} value={day} onDismiss={() => setPicker(null)} onPick={(ms) => { setPicker(null); if (ms !== null) setDay(ms); }} />
      {picker === 'time' && (
        <DateTimePicker
          mode="time"
          value={new Date(2000, 0, 1, start.h, start.m)}
          is24Hour
          onChange={(e: DateTimePickerEvent, d?: Date) => {
            setPicker(null);
            if (e.type === 'set' && d) setStart({ h: d.getHours(), m: d.getMinutes() });
          }}
        />
      )}
      <Sheet visible={picker === 'length'} title="How long" onDismiss={() => setPicker(null)}>
        {[15, 30, 45, 60, 90, 120, 180].map((m) => (
          <SheetRow key={m} icon="timer-outline" label={m < 60 ? `${m} minutes` : `${m / 60} ${m === 60 ? 'hour' : 'hours'}`} on={length === m} onPress={() => { setLength(m); setPicker(null); }} />
        ))}
      </Sheet>
      <Sheet visible={picker === 'reminder'} title="Reminder" onDismiss={() => setPicker(null)}>
        {REMINDERS.map((r) => (
          <SheetRow key={r.label} icon={r.minutes === null ? 'bell-off-outline' : 'bell-outline'} label={r.label} on={reminder === r.minutes} onPress={() => { setReminder(r.minutes); setPicker(null); }} />
        ))}
      </Sheet>
      <Sheet visible={picker === 'calendar'} title="Calendar" onDismiss={() => setPicker(null)}>
        {calendars.map((x) => (
          <SheetRow key={x.id} icon={x.isGoogle ? 'google' : 'calendar'} label={`${x.title}${x.account && x.account !== x.title ? ` · ${x.account}` : ''}`} on={calendarId === x.id} onPress={() => { setCalendarId(x.id); setPicker(null); }} />
        ))}
      </Sheet>
    </View>
  );

  function Row({ icon, label, onPress, dot }: { icon: IconName; label: string; onPress: () => void; dot?: string }) {
    return (
      <Pressable onPress={onPress} android_ripple={{ color: c.rule }} accessibilityRole="button" style={[styles.row, { borderBottomColor: c.rule }]}>
        <Icon name={icon} color={c.inkMuted} />
        <Text style={[type.body, { color: c.ink, flex: 1 }]} numberOfLines={1}>{label}</Text>
        {dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : <Icon name="chevron-right" color={c.ruleStrong} />}
      </Pressable>
    );
  }
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', height: 64, paddingHorizontal: space(1), paddingRight: space(4), gap: space(2), borderBottomWidth: StyleSheet.hairlineWidth },
  iconBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  save: { height: 40, borderRadius: 20, paddingHorizontal: space(5), justifyContent: 'center' },
  title: { paddingHorizontal: space(5), paddingVertical: space(4), borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(4), minHeight: 56, paddingHorizontal: space(5), borderBottomWidth: StyleSheet.hairlineWidth },
  dot: { width: 12, height: 12, borderRadius: 6 },
  notes: { paddingHorizontal: space(5), paddingVertical: space(4), minHeight: 96, textAlignVertical: 'top' },
  error: { paddingHorizontal: space(5), paddingTop: space(2) },
});
