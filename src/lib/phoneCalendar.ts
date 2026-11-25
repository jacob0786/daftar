import * as Calendar from 'expo-calendar';

// Events live in the phone's own calendar (your Google Calendar account on Android), never in notes.
// Android syncs them to Google, so they show up in Google Calendar everywhere with their reminders.

export type PhoneCalendar = { id: string; title: string; color: string; account: string; isGoogle: boolean; isPrimary: boolean };
export type PhoneEvent = { id: string; title: string; start: number; end: number; allDay: boolean; color: string };

export const available = true;

export async function hasPermission() {
  return (await Calendar.getCalendarPermissionsAsync()).granted;
}

export async function askPermission() {
  return (await Calendar.requestCalendarPermissionsAsync()).granted;
}

// Calendars you can add to, Google ones first, the main (primary) one at the top
export async function writableCalendars(): Promise<PhoneCalendar[]> {
  const all = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  return all
    .filter((c) => c.allowsModifications)
    .map((c) => ({
      id: c.id,
      title: c.title,
      color: c.color ?? '#888888',
      account: c.source?.name ?? '',
      isGoogle: c.source?.type === 'com.google',
      isPrimary: !!c.isPrimary || c.title === c.source?.name,
    }))
    .sort((a, b) => Number(b.isGoogle) - Number(a.isGoogle) || Number(b.isPrimary) - Number(a.isPrimary) || a.title.localeCompare(b.title));
}

export async function eventsBetween(from: number, to: number): Promise<PhoneEvent[]> {
  if (!(await hasPermission())) return [];
  const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const colour = new Map(cals.map((c) => [c.id, c.color ?? '#888888']));
  const events = await Calendar.getEventsAsync(cals.map((c) => c.id), new Date(from), new Date(to));
  return events
    .map((e) => ({
      id: e.id,
      title: e.title || '(No title)',
      start: new Date(e.startDate).getTime(),
      end: new Date(e.endDate).getTime(),
      allDay: !!e.allDay,
      color: colour.get(e.calendarId) ?? '#888888',
    }))
    .sort((a, b) => a.start - b.start);
}

export async function createEvent(e: {
  calendarId: string; title: string; start: Date; end: Date; allDay: boolean; reminderMinutes: number | null; notes?: string; location?: string;
}) {
  return Calendar.createEventAsync(e.calendarId, {
    title: e.title,
    startDate: e.start,
    endDate: e.end,
    allDay: e.allDay,
    notes: e.notes || undefined,
    location: e.location || undefined,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    alarms: e.reminderMinutes === null ? [] : [{ relativeOffset: -e.reminderMinutes, method: Calendar.AlarmMethod.ALERT }],
  });
}

// Open the event in the phone's calendar app
export function openEvent(id: string) {
  return Calendar.openEventInCalendarAsync({ id }).catch(() => {});
}
