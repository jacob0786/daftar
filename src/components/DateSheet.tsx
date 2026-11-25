import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { startOfDay } from '@/lib/dates';
import { space, type, useTheme } from '@/theme';
import { Sheet } from './FilterChips';
import { MonthGrid } from './MonthGrid';

const DAY = 86_400_000;

// Pick the calendar date a note is about (shows the note on that day in Calendar)
export function DateSheet({ visible, value, onPick, onDismiss }: { visible: boolean; value: number | null; onPick: (ms: number | null) => void; onDismiss: () => void }) {
  const { c } = useTheme();
  const [month, setMonth] = useState(new Date(value ?? Date.now()));
  useEffect(() => {
    if (visible) setMonth(new Date(value ?? Date.now()));
  }, [visible, value]);

  const today = startOfDay(Date.now());
  const quick = [
    { label: 'Today', ms: today },
    { label: 'Tomorrow', ms: startOfDay(today + DAY * 1.5) },
    { label: 'Next week', ms: startOfDay(today + DAY * 7.5) },
  ];

  return (
    <Sheet visible={visible} title="Date" onDismiss={onDismiss}>
      <View style={styles.quick}>
        {quick.map((q) => (
          <Pressable key={q.label} onPress={() => onPick(q.ms)} style={[styles.chip, { borderColor: c.ruleStrong }]} accessibilityRole="button" android_ripple={{ color: c.rule }}>
            <Text style={[type.label, { color: c.ink }]}>{q.label}</Text>
          </Pressable>
        ))}
        {value !== null && (
          <Pressable onPress={() => onPick(null)} style={[styles.chip, { borderColor: c.ruleStrong }]} accessibilityRole="button" android_ripple={{ color: c.rule }}>
            <Text style={[type.label, { color: c.danger }]}>Remove date</Text>
          </Pressable>
        )}
      </View>
      <MonthGrid month={month} selected={value} onSelect={onPick} onMonth={setMonth} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), paddingHorizontal: space(6), paddingBottom: space(2) },
  chip: { height: 36, borderRadius: 8, borderWidth: 1, paddingHorizontal: space(3), justifyContent: 'center', overflow: 'hidden' },
});
