// The desktop app has no phone calendar: events are created on the phone.
export type PhoneCalendar = { id: string; title: string; color: string; account: string; isGoogle: boolean; isPrimary: boolean };
export type PhoneEvent = { id: string; title: string; start: number; end: number; allDay: boolean; color: string };

export const available = false;
export const hasPermission = async () => false;
export const askPermission = async () => false;
export const writableCalendars = async (): Promise<PhoneCalendar[]> => [];
export const eventsBetween = async (_from: number, _to: number): Promise<PhoneEvent[]> => [];
export const createEvent = async (_e: unknown): Promise<string> => {
  throw new Error('Calendar events are added from the phone app.');
};
export const openEvent = async (_id: string) => {};
