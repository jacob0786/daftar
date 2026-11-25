import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { space } from '@/theme';
import { Icon, type IconName } from './Icon';

export type SwipeSide = { icon: IconName; color: string; label: string; run: () => void };

// A row you can swipe sideways: right runs `right`, left runs `left`.
// Past a third of the width (or a quick flick) the action runs; otherwise the row springs back.
export function SwipeRow({ left, right, enabled = true, children }: { left?: SwipeSide; right?: SwipeSide; enabled?: boolean; children: ReactNode }) {
  const tx = useSharedValue(0);
  const width = useSharedValue(360);
  const canRight = !!right, canLeft = !!left;

  // Run the action; the row normally disappears from the list. If it's still there a moment later, slide it back.
  const finish = (goRight: boolean) => {
    (goRight ? right : left)?.run();
    setTimeout(() => { tx.value = 0; }, 900);
  };

  const pan = Gesture.Pan()
    .enabled(enabled && (canLeft || canRight))
    .activeOffsetX([-18, 18])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      // Only move towards a side that has an action
      const x = e.translationX;
      tx.value = (x > 0 && !canRight) || (x < 0 && !canLeft) ? 0 : x;
    })
    .onEnd((e) => {
      const x = tx.value;
      const far = Math.abs(x) > width.value / 3 || (Math.abs(e.velocityX) > 900 && Math.abs(x) > 40);
      if (far && x !== 0) {
        const goRight = x > 0;
        tx.value = withTiming((goRight ? 1 : -1) * width.value, { duration: 150 }, (ok) => {
          if (ok) scheduleOnRN(finish, goRight);
        });
      } else {
        tx.value = withTiming(0, { duration: 160 });
      }
    });

  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));
  const rightBg = useAnimatedStyle(() => ({ opacity: tx.value > 0 ? 1 : 0 }));
  const leftBg = useAnimatedStyle(() => ({ opacity: tx.value < 0 ? 1 : 0 }));

  return (
    <Animated.View
      onLayout={(e) => { width.value = e.nativeEvent.layout.width; }}
      accessibilityActions={[...(right ? [{ name: 'right', label: right.label }] : []), ...(left ? [{ name: 'left', label: left.label }] : [])]}
      onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'right' ? right?.run() : left?.run())}>
      {right ? (
        <Animated.View style={[StyleSheet.absoluteFill, styles.bg, { backgroundColor: right.color, justifyContent: 'flex-start' }, rightBg]}>
          <Icon name={right.icon} size={24} color="#FFFFFF" />
        </Animated.View>
      ) : null}
      {left ? (
        <Animated.View style={[StyleSheet.absoluteFill, styles.bg, { backgroundColor: left.color, justifyContent: 'flex-end' }, leftBg]}>
          <Icon name={left.icon} size={24} color="#FFFFFF" />
        </Animated.View>
      ) : null}
      <GestureDetector gesture={pan}>
        <Animated.View style={slide}>{children}</Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bg: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space(6) },
});
