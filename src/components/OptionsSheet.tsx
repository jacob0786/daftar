import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { saveLabel } from '@/db/database';
import type { ColorIndex, Label, Note } from '@/db/types';
import { COLOR_NAMES, space, type, useTheme } from '@/theme';
import { PromptDialog } from './Dialog';
import { Icon, type IconName } from './Icon';

export type SheetAction = { icon: IconName; label: string; onPress: () => void; tone?: 'danger' };

type Props = {
  visible: boolean;
  note: Note;
  labels: Label[];
  colorNames: (string | null)[];
  actions: SheetAction[];
  onColor: (c: ColorIndex | null) => void;
  onToggleLabel: (id: string) => void;
  onDismiss: () => void;
};

// Bottom sheet: tags (one colour tag + any topic tags), and note actions
export function OptionsSheet({ visible, note, labels, colorNames, actions, onColor, onToggleLabel, onDismiss }: Props) {
  const { c, ink } = useTheme();
  const insets = useSafeAreaInsets();
  const [newLabel, setNewLabel] = useState(false);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss} statusBarTranslucent>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onDismiss} accessibilityLabel="Close options" />
      <View style={[styles.sheet, { backgroundColor: c.ground, paddingBottom: insets.bottom + space(4) }]}>
        <View style={[styles.handle, { backgroundColor: c.ruleStrong }]} />
        <ScrollView>
          {/* One place for tags. Colour tags (pick one) set the note's colour; topic tags (pick any) group it. */}
          <Text style={[type.labelSmall, styles.heading, { color: c.inkMuted }]}>COLOUR TAG</Text>
          <View style={styles.labels}>
            {COLOR_NAMES.map((name, i) => {
              const on = note.color === i;
              return (
                <Pressable
                  key={name}
                  onPress={() => onColor(on ? null : (i as ColorIndex))}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={[styles.labelChip, on ? { backgroundColor: c.primaryContainer, borderColor: c.primaryContainer } : { borderColor: c.ruleStrong }]}>
                  <View style={[styles.tagDot, { backgroundColor: ink(i as ColorIndex), borderColor: c.ruleStrong }]} />
                  <Text style={[type.label, { color: on ? c.onPrimaryContainer : c.ink }]}>{colorNames[i] ?? name}</Text>
                  {on ? <Icon name="check" size={16} color={c.onPrimaryContainer} /> : null}
                </Pressable>
              );
            })}
          </View>

          <Text style={[type.labelSmall, styles.heading, { color: c.inkMuted }]}>TAGS</Text>
          <View style={styles.labels}>
            {labels.map((l) => {
              const on = note.labels.includes(l.id);
              return (
                <Pressable
                  key={l.id}
                  onPress={() => onToggleLabel(l.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={[styles.labelChip, on ? { backgroundColor: c.primaryContainer, borderColor: c.primaryContainer } : { borderColor: c.ruleStrong }]}>
                  <Icon name={on ? 'check' : 'tag-outline'} size={16} color={on ? c.onPrimaryContainer : c.inkMuted} />
                  <Text style={[type.label, { color: on ? c.onPrimaryContainer : c.ink }]}>{l.name}</Text>
                </Pressable>
              );
            })}
            <Pressable onPress={() => setNewLabel(true)} accessibilityRole="button" style={[styles.labelChip, { borderColor: c.ruleStrong, borderStyle: 'dashed' }]}>
              <Icon name="plus" size={16} color={c.primary} />
              <Text style={[type.label, { color: c.primary }]}>New tag</Text>
            </Pressable>
          </View>

          <View style={[styles.divider, { backgroundColor: c.rule }]} />
          {actions.map((a) => (
            <Pressable key={a.label} onPress={a.onPress} android_ripple={{ color: c.rule }} accessibilityRole="button" style={styles.action}>
              <Icon name={a.icon} color={a.tone === 'danger' ? c.danger : c.inkMuted} />
              <Text style={[type.body, { color: a.tone === 'danger' ? c.danger : c.ink }]}>{a.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <PromptDialog
        visible={newLabel}
        title="New tag"
        placeholder="e.g. Tajwid, Shopping"
        confirm="Add"
        onDismiss={() => setNewLabel(false)}
        onSubmit={async (v) => {
          setNewLabel(false);
          if (v.trim()) onToggleLabel(await saveLabel(v));
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '80%', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: space(2) },
  handle: { alignSelf: 'center', width: 32, height: 4, borderRadius: 2, marginVertical: space(2) },
  heading: { paddingHorizontal: space(6), paddingTop: space(4), paddingBottom: space(2), letterSpacing: 0.8 },
  labels: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), paddingHorizontal: space(6) },
  tagDot: { width: 14, height: 14, borderRadius: 4, borderWidth: StyleSheet.hairlineWidth },
  labelChip: { height: 32, borderRadius: 8, borderWidth: 1, paddingHorizontal: space(3), flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  divider: { height: StyleSheet.hairlineWidth, marginTop: space(5), marginBottom: space(1) },
  action: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space(4), paddingHorizontal: space(6) },
});
