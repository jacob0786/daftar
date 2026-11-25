import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { space, type, useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';

// One primary action: New. Opens a short menu (note, list, and a calendar event on the phone).
export function Fab({ onNote, onList, onEvent }: { onNote: () => void; onList: () => void; onEvent?: () => void }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);

  const pick = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <>
      {open && <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={() => setOpen(false)} accessibilityLabel="Close menu" />}
      <View style={[styles.wrap, { bottom: space(4) }]} pointerEvents="box-none">
        {open && (
          <View style={styles.menu}>
            {onEvent && Platform.OS !== 'web' ? <MenuItem icon="calendar-plus" label="Calendar event" onPress={() => pick(onEvent)} /> : null}
            <MenuItem icon="format-list-checks" label="Checklist" onPress={() => pick(onList)} />
            <MenuItem icon="text-long" label="Note" onPress={() => pick(onNote)} />
          </View>
        )}
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setOpen((o) => !o);
          }}
          android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: false }}
          accessibilityRole="button"
          accessibilityLabel={open ? 'Close new menu' : 'New note, list or event'}
          style={[styles.fab, { backgroundColor: c.primary }]}>
          <Icon name={open ? 'close' : 'plus'} size={24} color={c.onPrimary} />
          {!open && <Text style={[type.label, { color: c.onPrimary }]}>New</Text>}
        </Pressable>
      </View>
    </>
  );

  function MenuItem({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
    return (
      <Pressable
        onPress={onPress}
        android_ripple={{ color: c.rule }}
        accessibilityRole="button"
        style={[styles.item, { backgroundColor: c.primaryContainer }]}>
        <Icon name={icon} size={22} color={c.onPrimaryContainer} />
        <Text style={[type.label, { color: c.onPrimaryContainer }]}>{label}</Text>
      </Pressable>
    );
  }
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: space(4), alignItems: 'flex-end', gap: space(3) },
  menu: { alignItems: 'flex-end', gap: space(2) },
  item: { height: 56, borderRadius: 28, paddingHorizontal: space(5), flexDirection: 'row', alignItems: 'center', gap: space(3), overflow: 'hidden', elevation: 3 },
  fab: { height: 56, minWidth: 56, borderRadius: 16, paddingHorizontal: space(4), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space(2), overflow: 'hidden', elevation: 4 },
});
