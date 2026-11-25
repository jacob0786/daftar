import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { space, type, useTheme } from '@/theme';
import { Icon } from './Icon';

// The coloured timetable header shared by every list screen
export function ShellHeader({ title, sub, right, children, onBack }: { title?: string; sub?: string; right?: ReactNode; children?: ReactNode; onBack?: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { backgroundColor: c.shell, paddingTop: insets.top + (title ? space(5) : space(3)) }]}>
      {title ? (
        <View style={styles.top}>
          {onBack ? (
            <Pressable onPress={onBack} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
              <Icon name="arrow-left" color={c.onShell} />
            </Pressable>
          ) : null}
          <Text style={[type.headline, { color: c.onShell, fontVariant: ['tabular-nums'], flex: 1 }]} accessibilityRole="header" numberOfLines={1}>
            {title}
          </Text>
          {right}
        </View>
      ) : null}
      {sub ? <Text style={[type.bodySmall, { color: c.onShellMuted, marginTop: space(0.5) }]}>{sub}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space(5), paddingBottom: space(4) },
  top: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  back: { width: 40, height: 48, justifyContent: 'center', marginLeft: -space(2) },
});
