import * as chrono from 'chrono-node';

import { startOfDay } from './dates';

// Find the first real date a note mentions ("12 March", "next Friday", "3/4/2027"), British day-first.
// Only dates with a definite day count; times alone ("at 5pm") are ignored.
export function detectDate(text: string, ref = new Date()): { at: number; phrase: string } | null {
  if (!text.trim()) return null;
  const results = chrono.en.GB.parse(text.slice(0, 4000), ref, { forwardDate: true });
  for (const r of results) {
    if (!r.start.isCertain('day') && !r.start.isCertain('weekday')) continue;
    return { at: startOfDay(r.start.date().getTime()), phrase: r.text };
  }
  return null;
}
