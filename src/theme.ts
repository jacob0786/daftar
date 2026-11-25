import { useColorScheme } from 'react-native';

import type { ColorIndex } from '@/db/types';
import { usePrefs, type Accent, type FontSize, type Prefs, type RowHeight } from '@/lib/prefs';

// --- Timetable palette: coloured shell, warm paper, hairline rules, one gold for "today" ---
const light = {
  shell: '#0E4A3B',
  onShell: '#F4F1E6',
  onShellMuted: '#C9D8CF',
  shellField: '#1D5A4A',
  ground: '#FAFAF6',
  groundAlt: '#F1F2EC',
  ink: '#1B211E',
  inkMuted: '#56605A',
  rule: '#D8DDD8',
  ruleStrong: '#C2C9C3',
  primary: '#0E4A3B',
  onPrimary: '#FFFFFF',
  primaryContainer: '#CFE3D9',
  onPrimaryContainer: '#0A3329',
  gold: '#F0B93A',
  goldInk: '#8A6200', // gold dark enough to read as text on paper
  onGold: '#2A1F00',
  goldWash: '#FFF4D6',
  danger: '#B3261E',
  scrim: 'rgba(10, 20, 16, 0.4)',
};

const dark: typeof light = {
  shell: '#0B2E25',
  onShell: '#E9EEE9',
  onShellMuted: '#A9BDB2',
  shellField: '#164035',
  ground: '#121614',
  groundAlt: '#1A201D',
  ink: '#E6EAE6',
  inkMuted: '#A3ADA6',
  rule: '#2A322E',
  ruleStrong: '#3A443F',
  primary: '#8CCFB2',
  onPrimary: '#00382A',
  primaryContainer: '#1F4A3D',
  onPrimaryContainer: '#CFE9DD',
  gold: '#E3AE3A',
  goldInk: '#E3AE3A',
  onGold: '#241A00',
  goldWash: '#221F16',
  danger: '#F2B8B5',
  scrim: 'rgba(0, 0, 0, 0.55)',
};

export type Palette = typeof light;

// --- Accent themes: only the shell and primary roles change; paper, ink and gold stay ---
type AccentSet = Pick<Palette, 'shell' | 'onShellMuted' | 'shellField' | 'primary' | 'onPrimary' | 'primaryContainer' | 'onPrimaryContainer'>;
const ACCENTS: Record<Accent, { name: string; light: AccentSet; dark: AccentSet }> = {
  masjid: {
    name: 'Masjid',
    light: { shell: '#0E4A3B', onShellMuted: '#C9D8CF', shellField: '#1D5A4A', primary: '#0E4A3B', onPrimary: '#FFFFFF', primaryContainer: '#CFE3D9', onPrimaryContainer: '#0A3329' },
    dark: { shell: '#0B2E25', onShellMuted: '#A9BDB2', shellField: '#164035', primary: '#8CCFB2', onPrimary: '#00382A', primaryContainer: '#1F4A3D', onPrimaryContainer: '#CFE9DD' },
  },
  ink: {
    name: 'Ink',
    light: { shell: '#1D3557', onShellMuted: '#C3D0E2', shellField: '#2B4569', primary: '#1D3557', onPrimary: '#FFFFFF', primaryContainer: '#D4E0F0', onPrimaryContainer: '#0E2340' },
    dark: { shell: '#14233A', onShellMuted: '#A9B9D0', shellField: '#1F3250', primary: '#A8C4EA', onPrimary: '#0E2340', primaryContainer: '#25395A', onPrimaryContainer: '#D4E0F0' },
  },
  clay: {
    name: 'Clay',
    light: { shell: '#6E3424', onShellMuted: '#E6C9BE', shellField: '#82432F', primary: '#8A4430', onPrimary: '#FFFFFF', primaryContainer: '#F3D9CF', onPrimaryContainer: '#3A160B' },
    dark: { shell: '#3A1C14', onShellMuted: '#D6B4A8', shellField: '#4C281E', primary: '#F0B4A0', onPrimary: '#4A1C0F', primaryContainer: '#5A2E22', onPrimaryContainer: '#F3D9CF' },
  },
  slate: {
    name: 'Slate',
    light: { shell: '#2F3537', onShellMuted: '#CBD2D4', shellField: '#40484B', primary: '#3A4245', onPrimary: '#FFFFFF', primaryContainer: '#DCE2E4', onPrimaryContainer: '#1A1F21' },
    dark: { shell: '#1C2022', onShellMuted: '#AEB7BA', shellField: '#2A3033', primary: '#BCC6CA', onPrimary: '#20272A', primaryContainer: '#333B3E', onPrimaryContainer: '#DCE2E4' },
  },
};
export const ACCENT_LIST = (Object.keys(ACCENTS) as Accent[]).map((id) => ({ id, name: ACCENTS[id].name, swatch: ACCENTS[id].light.shell }));

// True-black dark mode for OLED screens
const BLACK: Partial<Palette> = { ground: '#000000', groundAlt: '#0B0D0C', rule: '#222826', ruleStrong: '#323A36', goldWash: '#1B1912' };

// --- ColorNote's 9 colour slots as muted print inks (row bands only) ---
export const COLOR_NAMES = ['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Black', 'Grey', 'White'] as const;
export const inksLight = ['#C0392B', '#C9721A', '#D4A017', '#3E8E41', '#3A6EA5', '#8A5A9E', '#2B2B2B', '#8C938E', '#E2E4DE'];
export const inksDark = ['#E0685A', '#E39A4B', '#E8C04E', '#6DB36F', '#6E9FD4', '#B58AC8', '#5F6662', '#8D958F', '#E8EAE6'];

// --- Type scale (sp). Sizes follow the Font size setting and Android's own font scaling. ---
const BASE = {
  headline: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const, letterSpacing: -0.4 },
  title: { fontSize: 24, lineHeight: 31, fontWeight: '500' as const },
  rowTitle: { fontSize: 18, lineHeight: 24, fontWeight: '500' as const },
  titleMedium: { fontSize: 16, lineHeight: 22, fontWeight: '500' as const, letterSpacing: 0.1 },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  reading: { fontSize: 18, lineHeight: 28, fontWeight: '400' as const }, // note text in the editor
  bodySmall: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '500' as const, letterSpacing: 0.1 },
  labelSmall: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const, letterSpacing: 0.5 },
  day: { fontSize: 19, lineHeight: 22, fontWeight: '500' as const, fontVariant: ['tabular-nums'] as 'tabular-nums'[] },
};
const SCALE: Record<FontSize, number> = { small: 0.9, default: 1, large: 1.12, larger: 1.25 };

// Shared object, rescaled in place when the setting changes (every screen re-renders via useTheme)
export const type: typeof BASE = JSON.parse(JSON.stringify(BASE));
let appliedScale = 1;
function applyScale(s: number) {
  if (s === appliedScale) return;
  appliedScale = s;
  for (const k of Object.keys(BASE) as (keyof typeof BASE)[]) {
    type[k].fontSize = Math.round(BASE[k].fontSize * s);
    type[k].lineHeight = Math.round(BASE[k].lineHeight * s);
  }
}

const ROW: Record<RowHeight, { min: number; pad: number }> = {
  compact: { min: 56, pad: 2 },
  comfortable: { min: 68, pad: 3 },
  roomy: { min: 84, pad: 4.5 },
};

export function paletteFor(p: Prefs, systemDark: boolean) {
  const isDark = p.theme === 'dark' || (p.theme === 'system' && systemDark);
  const accent = ACCENTS[p.accent] ?? ACCENTS.masjid;
  const c: Palette = { ...(isDark ? dark : light), ...(isDark ? accent.dark : accent.light), ...(isDark && p.trueBlack ? BLACK : {}) };
  return { c, isDark };
}

export function useTheme() {
  const scheme = useColorScheme();
  const prefs = usePrefs();
  applyScale(SCALE[prefs.fontSize] ?? 1);
  const { c, isDark } = paletteFor(prefs, scheme === 'dark');
  const inks = isDark ? inksDark : inksLight;
  return {
    c,
    isDark,
    prefs,
    row: ROW[prefs.rowHeight] ?? ROW.comfortable,
    ink: (i: ColorIndex | null) => (i === null ? 'transparent' : inks[i]),
  };
}

// One 4dp module; rows and gaps snap to it
export const space = (n: number) => n * 4;
export const BAND = 6;
export const DAY_COL = 56;
