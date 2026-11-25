import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';

import { space, type, useTheme } from '@/theme';

export type SnackMessage = { text: string; action?: { label: string; run: () => void } } | null;

// Material snackbar: transient feedback with an optional Undo
export function Snackbar({ message, onDone, bottom = 88 }: { message: SnackMessage; onDone: () => void; bottom?: number }) {
  const { c, isDark } = useTheme();
  const [shown, setShown] = useState<SnackMessage>(null);
  const y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) return;
    setShown(message);
    y.setValue(0);
    Animated.timing(y, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    const t = setTimeout(() => {
      Animated.timing(y, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
        setShown(null);
        onDone();
      });
    }, 4000);
    return () => clearTimeout(t);
  }, [message, onDone, y]);

  if (!shown) return null;
  const bg = isDark ? '#E6EAE6' : '#2C332F';
  const fg = isDark ? '#1B211E' : '#F1F2EC';
  const accent = isDark ? c.shell : '#9FD9BF';

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={[styles.bar, { backgroundColor: bg, bottom, opacity: y, transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
      <Text style={[type.bodySmall, { color: fg, flex: 1 }]}>{shown.text}</Text>
      {shown.action && (
        <Pressable
          onPress={() => {
            shown.action?.run();
            setShown(null);
            onDone();
          }}
          hitSlop={12}
          accessibilityRole="button">
          <Text style={[type.label, { color: accent }]}>{shown.action.label}</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: space(4), right: space(4), minHeight: 48, borderRadius: 4, paddingHorizontal: space(4), paddingVertical: space(3), flexDirection: 'row', alignItems: 'center', gap: space(4), elevation: 6 },
});
