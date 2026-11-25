import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { SortOrder } from '@/db/database';
import type { ColorIndex, Label, NoteKind } from '@/db/types';
import { COLOR_NAMES, space, type, useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';

export type Filter = { kind?: NoteKind; color?: ColorIndex; labelId?: string };

export const SORTS: { id: SortOrder; label: string; icon: IconName }[] = [
  { id: 'edited', label: 'Last edited', icon: 'pencil-outline' },
  { id: 'created', label: 'Date created', icon: 'clock-plus-outline' },
  { id: 'date', label: 'Calendar date', icon: 'calendar-blank-outline' },
  { id: 'title', label: 'Title A–Z', icon: 'sort-alphabetical-ascending' },
  { id: 'color', label: 'Colour', icon: 'palette-outline' },
];

type Props = {
  value: Filter;
  onChange: (f: Filter) => void;
  colors: Map<number, number>;
  colorNames: (string | null)[];
  labels: Label[];
  labelCounts: Map<string, number>;
  onNameColor: (i: ColorIndex) => void;
  onManageLabel: (l: Label) => void;
  sort: SortOrder;
  onSort: (s: SortOrder) => void;
};

// One row: All / Notes / Lists, the colour tags in use (each colour is a tag, named in the app), then a Tags chip
// that opens every tag. Sort sits at the end.
export function FilterChips({ value, onChange, colors, colorNames, labels, labelCounts, onNameColor, onManageLabel, sort, onSort }: Props) {
  const { c, ink } = useTheme();
  const [sheet, setSheet] = useState<'tags' | 'sort' | null>(null);
  const none = !value.kind && value.color === undefined && !value.labelId;
  const activeLabel = labels.find((l) => l.id === value.labelId);
  const hasTags = labels.length > 0 || colors.size > 0;

  return (
    <View style={[styles.bar, { borderBottomColor: c.rule }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={{ flex: 1 }}>
        <Chip on={none} label="All" onPress={() => onChange({})} />
        <Chip on={value.kind === 'text'} label="Notes" onPress={() => onChange(value.kind === 'text' ? {} : { kind: 'text' })} />
        <Chip on={value.kind === 'checklist'} label="Lists" onPress={() => onChange(value.kind === 'checklist' ? {} : { kind: 'checklist' })} />
        {[...colors.keys()].sort((a, b) => a - b).map((i) => (
          <Chip
            key={i}
            dot={ink(i as ColorIndex)}
            on={value.color === i}
            label={colorNames[i] ?? COLOR_NAMES[i]}
            a11y={`${colorNames[i] ?? COLOR_NAMES[i]} tag. Long-press to rename it.`}
            onPress={() => onChange(value.color === i ? {} : { color: i as ColorIndex })}
            onLongPress={() => onNameColor(i as ColorIndex)}
          />
        ))}
        {hasTags && (
          <Chip
            on={!!activeLabel}
            icon="tag-outline"
            label={activeLabel ? activeLabel.name : 'All tags'}
            trailing="menu-down"
            onPress={() => setSheet('tags')}
          />
        )}
      </ScrollView>
      <Pressable
        onPress={() => setSheet('sort')}
        style={[styles.sortBtn, { borderLeftColor: c.rule }]}
        accessibilityRole="button"
        accessibilityLabel={`Sort: ${SORTS.find((s) => s.id === sort)?.label}`}
        android_ripple={{ color: c.rule, borderless: true, radius: 24 }}>
        <Icon name="sort" size={22} color={sort === 'edited' ? c.inkMuted : c.primary} />
      </Pressable>

      <Sheet visible={sheet === 'tags'} title="Tags" onDismiss={() => setSheet(null)}>
        <Text style={[type.bodySmall, styles.hint, { color: c.inkMuted }]}>
          Colour tags give a note its colour; a note has one. Other tags group notes by topic, as many as you like. Long-press any tag to rename it.
        </Text>
        {/* Colour tags first (the ones in use), then the rest */}
        {[...colors.keys()].sort((a, b) => a - b).map((i) => (
          <SheetRow
            key={`c${i}`}
            icon={value.color === i ? 'check' : 'circle'}
            iconColor={value.color === i ? undefined : ink(i as ColorIndex)}
            label={colorNames[i] ?? COLOR_NAMES[i]}
            count={colors.get(i) ?? 0}
            on={value.color === i}
            onPress={() => { onChange(value.color === i ? {} : { color: i as ColorIndex }); setSheet(null); }}
            onLongPress={() => { setSheet(null); onNameColor(i as ColorIndex); }}
          />
        ))}
        {labels.map((l) => (
          <SheetRow
            key={l.id}
            icon={value.labelId === l.id ? 'check' : 'tag-outline'}
            label={l.name}
            count={labelCounts.get(l.id) ?? 0}
            on={value.labelId === l.id}
            onPress={() => { onChange(value.labelId === l.id ? {} : { labelId: l.id }); setSheet(null); }}
            onLongPress={() => { setSheet(null); onManageLabel(l); }}
          />
        ))}
      </Sheet>

      <Sheet visible={sheet === 'sort'} title="Sort by" onDismiss={() => setSheet(null)}>
        {SORTS.map((s) => (
          <SheetRow key={s.id} icon={s.icon} label={s.label} on={sort === s.id} onPress={() => { onSort(s.id); setSheet(null); }} />
        ))}
      </Sheet>
    </View>
  );

  function Chip({ on, label, onPress, onLongPress, dot, icon, trailing, a11y }: {
    on: boolean; label: string; onPress: () => void; onLongPress?: () => void; dot?: string; icon?: IconName; trailing?: IconName; a11y?: string;
  }) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityRole="button"
        accessibilityLabel={a11y ?? label}
        accessibilityState={{ selected: on }}
        android_ripple={{ color: c.rule }}
        style={[styles.chip, !label && styles.dotChip, on ? { backgroundColor: c.primary, borderColor: c.primary } : { borderColor: c.ruleStrong }]}>
        {on && !dot && !icon ? <Icon name="check" size={16} color={c.onPrimary} /> : null}
        {dot ? <View style={[styles.dot, { backgroundColor: dot, borderColor: on ? c.onPrimary : c.ruleStrong }]} /> : null}
        {icon ? <Icon name={icon} size={16} color={on ? c.onPrimary : c.inkMuted} /> : null}
        {label ? (
          <Text style={[type.label, { color: on ? c.onPrimary : c.ink, maxWidth: 160 }]} numberOfLines={1}>
            {label}
          </Text>
        ) : null}
        {trailing ? <Icon name={trailing} size={18} color={on ? c.onPrimary : c.inkMuted} /> : null}
      </Pressable>
    );
  }
}

// Bottom sheet used for the tag list and sort options
export function Sheet({ visible, title, onDismiss, children }: { visible: boolean; title: string; onDismiss: () => void; children: React.ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss} statusBarTranslucent>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onDismiss} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: c.ground, paddingBottom: insets.bottom + space(3) }]}>
        <View style={[styles.handle, { backgroundColor: c.ruleStrong }]} />
        <Text style={[type.titleMedium, styles.sheetTitle, { color: c.ink }]} accessibilityRole="header">{title}</Text>
        <ScrollView>{children}</ScrollView>
      </View>
    </Modal>
  );
}

export function SheetRow({ icon, iconColor, label, count, on, onPress, onLongPress, tone }: {
  icon: IconName; iconColor?: string; label: string; count?: number; on?: boolean; onPress: () => void; onLongPress?: () => void; tone?: 'danger';
}) {
  const { c } = useTheme();
  const fg = tone === 'danger' ? c.danger : on ? c.primary : c.ink;
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} android_ripple={{ color: c.rule }} accessibilityRole="button" accessibilityState={{ selected: on }} style={styles.sheetRow}>
      <Icon name={icon} color={iconColor ?? (tone === 'danger' ? c.danger : on ? c.primary : c.inkMuted)} />
      <Text style={[type.body, { color: fg, flex: 1 }]} numberOfLines={1}>{label}</Text>
      {count !== undefined ? <Text style={[type.labelSmall, { color: c.inkMuted, fontVariant: ['tabular-nums'] }]}>{count}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  row: { paddingLeft: space(4), paddingRight: space(2), paddingVertical: space(3), gap: space(2) },
  chip: { height: 32, borderRadius: 8, borderWidth: 1, paddingHorizontal: space(3), flexDirection: 'row', alignItems: 'center', gap: space(1.5), overflow: 'hidden' },
  dotChip: { paddingHorizontal: 0, width: 36, justifyContent: 'center' },
  dot: { width: 14, height: 14, borderRadius: 4, borderWidth: StyleSheet.hairlineWidth },
  sortBtn: { width: 52, height: 48, alignItems: 'center', justifyContent: 'center', borderLeftWidth: StyleSheet.hairlineWidth },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '75%', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: space(2) },
  handle: { alignSelf: 'center', width: 32, height: 4, borderRadius: 2, marginVertical: space(2) },
  sheetTitle: { paddingHorizontal: space(6), paddingTop: space(2), paddingBottom: space(2) },
  hint: { paddingHorizontal: space(6), paddingBottom: space(2) },
  sheetRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: space(4), paddingHorizontal: space(6) },
});
