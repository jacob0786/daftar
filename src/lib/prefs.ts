import { useEffect, useState } from 'react';

import { getMeta, setMeta, type SortOrder } from '@/db/database';
import type { ColorIndex } from '@/db/types';

// --- Everything the Settings screen can change. Stored on this device only. ---
export type ThemeMode = 'system' | 'light' | 'dark';
export type Accent = 'masjid' | 'ink' | 'clay' | 'slate';
export type FontSize = 'small' | 'default' | 'large' | 'larger';
export type RowHeight = 'compact' | 'comfortable' | 'roomy';
export type ListView = 'timetable' | 'simple';

export type Prefs = {
  theme: ThemeMode;
  accent: Accent;
  trueBlack: boolean; // pure black background in dark mode (saves battery on OLED screens)
  fontSize: FontSize;
  rowHeight: RowHeight;
  view: ListView;
  defaultSort: SortOrder;
  defaultColor: ColorIndex | null;
  syncOnLaunch: boolean;
  showHijri: boolean;
  hijriAdjust: number; // -2..2 days
  detectDates: boolean; // suggest a calendar date when a note mentions one
};

export const DEFAULT_PREFS: Prefs = {
  theme: 'system',
  accent: 'masjid',
  trueBlack: false,
  fontSize: 'default',
  rowHeight: 'comfortable',
  view: 'timetable',
  defaultSort: 'edited',
  defaultColor: null,
  syncOnLaunch: true,
  showHijri: true,
  hijriAdjust: 0,
  detectDates: true,
};

let prefs: Prefs = DEFAULT_PREFS;
const listeners = new Set<(p: Prefs) => void>();

// Called once at start-up, before the first screen draws
export async function loadPrefs() {
  const raw = await getMeta('prefs');
  const legacyAdjust = await getMeta('hijri.adjust');
  prefs = { ...DEFAULT_PREFS, ...(legacyAdjust ? { hijriAdjust: Number(legacyAdjust) } : {}), ...(raw ? JSON.parse(raw) : {}) };
  listeners.forEach((fn) => fn(prefs));
  return prefs;
}

export function getPrefs() {
  return prefs;
}

export async function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
  prefs = { ...prefs, [key]: value };
  listeners.forEach((fn) => fn(prefs));
  await setMeta('prefs', JSON.stringify(prefs));
}

export function usePrefs() {
  const [p, setP] = useState(prefs);
  useEffect(() => {
    listeners.add(setP);
    setP(prefs);
    return () => {
      listeners.delete(setP);
    };
  }, []);
  return p;
}
