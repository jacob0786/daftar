import { Slot, usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { space, type, useTheme } from '@/theme';

const DESTINATIONS: { path: '/' | '/calendar' | '/archive' | '/settings'; label: string; icon: IconName; active: IconName }[] = [
  { path: '/', label: 'Notes', icon: 'notebook-outline', active: 'notebook' },
  { path: '/calendar', label: 'Calendar', icon: 'calendar-month-outline', active: 'calendar-month' },
  { path: '/archive', label: 'Archive', icon: 'archive-outline', active: 'archive' },
  { path: '/settings', label: 'Settings', icon: 'cog-outline', active: 'cog' },
];

// Desktop: a Material navigation rail on the left instead of the phone's bottom bar
export default function DesktopTabsLayout() {
  const { c } = useTheme();
  const router = useRouter();
  const path = usePathname();

  return (
    <View style={[styles.wrap, { backgroundColor: c.ground }]}>
      <View style={[styles.rail, { backgroundColor: c.groundAlt, borderRightColor: c.rule }]} accessibilityRole="tablist">
        {DESTINATIONS.map((d) => {
          const on = d.path === '/' ? path === '/' : path.startsWith(d.path);
          return (
            <Pressable key={d.path} onPress={() => router.navigate(d.path)} style={styles.item} accessibilityRole="tab" accessibilityState={{ selected: on }}>
              <View style={[styles.pill, on && { backgroundColor: c.primaryContainer }]}>
                <Icon name={on ? d.active : d.icon} color={on ? c.onPrimaryContainer : c.inkMuted} />
              </View>
              <Text style={[type.labelSmall, { color: on ? c.ink : c.inkMuted }]}>{d.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.content}>
        <Slot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, flexDirection: 'row' },
  rail: { width: 88, paddingTop: space(6), gap: space(3), alignItems: 'center', borderRightWidth: StyleSheet.hairlineWidth },
  item: { alignItems: 'center', gap: space(1), width: 80, paddingVertical: space(1) },
  pill: { width: 56, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, alignSelf: 'stretch' },
});
