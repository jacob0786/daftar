import { Pressable, StyleSheet, Text, View } from 'react-native';

import { hijri, MONTHS_LONG, sameDay, startOfDay } from '@/lib/dates';
import { space, type, useTheme } from '@/theme';
import { Icon } from './Icon';

const WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function dayKey(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

type Props = {
  month: Date; // any day in the month shown
  selected: number | null;
  marks?: Map<string, string[]>; // dayKey -> up to 3 dot colours
  onSelect: (ms: number) => void;
  onMonth: (d: Date) => void;
};

// A plain month: Monday first, today's number in gold, small dots for days that have notes
export function MonthGrid({ month, selected, marks, onSelect, onMonth }: Props) {
  const { c, prefs } = useTheme();
  const y = month.getFullYear(), m = month.getMonth();
  const first = new Date(y, m, 1);
  const lead = (first.getDay() + 6) % 7; // blanks before the 1st (Monday-first)
  const days = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  const h1 = hijri(first, prefs.hijriAdjust), h2 = hijri(new Date(y, m, days), prefs.hijriAdjust);
  const hijriSpan = h1.month === h2.month ? h1.english.replace(/^\d+ /, '') : `${h1.english.replace(/^\d+ /, '').replace(/ \d+$/, '')} – ${h2.english.replace(/^\d+ /, '')}`;

  return (
    <View>
      <View style={styles.head}>
        <Pressable onPress={() => onMonth(new Date(y, m - 1, 1))} style={styles.nav} accessibilityRole="button" accessibilityLabel="Previous month" android_ripple={{ color: c.rule, borderless: true, radius: 24 }}>
          <Icon name="chevron-left" color={c.ink} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[type.titleMedium, { color: c.ink }]} accessibilityRole="header">{MONTHS_LONG[m]} {y}</Text>
          {prefs.showHijri ? <Text style={[type.labelSmall, { color: c.inkMuted }]}>{hijriSpan}</Text> : null}
        </View>
        <Pressable onPress={() => onMonth(new Date(y, m + 1, 1))} style={styles.nav} accessibilityRole="button" accessibilityLabel="Next month" android_ripple={{ color: c.rule, borderless: true, radius: 24 }}>
          <Icon name="chevron-right" color={c.ink} />
        </Pressable>
      </View>

      <View style={styles.week}>
        {WEEK.map((d, i) => (
          <Text key={i} style={[type.labelSmall, styles.weekDay, { color: c.inkMuted }]}>{d}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((d, i) => {
          if (d === null) return <View key={i} style={styles.cell} />;
          const ms = new Date(y, m, d).getTime();
          const isToday = sameDay(ms, Date.now());
          const isSel = selected !== null && sameDay(ms, selected);
          const dots = marks?.get(dayKey(ms)) ?? [];
          return (
            <Pressable
              key={i}
              onPress={() => onSelect(startOfDay(ms))}
              style={styles.cell}
              accessibilityRole="button"
              accessibilityState={{ selected: isSel }}
              accessibilityLabel={`${d} ${MONTHS_LONG[m]}${dots.length ? `, ${dots.length} notes` : ''}`}>
              <View style={[styles.dayCircle, isSel && { backgroundColor: c.primary }]}>
                <Text style={[type.label, { color: isSel ? c.onPrimary : isToday ? c.goldInk : c.ink, fontWeight: isToday || isSel ? '700' : '500', fontVariant: ['tabular-nums'] }]}>{d}</Text>
              </View>
              <View style={styles.dots}>
                {dots.slice(0, 3).map((col, k) => (
                  <View key={k} style={[styles.dot, { backgroundColor: col === 'transparent' ? c.inkMuted : col }]} />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space(1), minHeight: 56 },
  nav: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  week: { flexDirection: 'row', paddingHorizontal: space(2) },
  weekDay: { flex: 1, textAlign: 'center', paddingVertical: space(1) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: space(2) },
  cell: { width: `${100 / 7}%`, height: 52, alignItems: 'center', justifyContent: 'center' },
  dayCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 3, height: 6, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
