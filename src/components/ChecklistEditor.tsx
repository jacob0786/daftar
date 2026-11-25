import * as Haptics from 'expo-haptics';
import { memo, useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { newId } from '@/db/database';
import type { ChecklistItem } from '@/db/types';
import { isRTL } from '@/lib/text';
import { space, type, useTheme } from '@/theme';
import { Icon } from './Icon';

type Props = {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  autoFocusFirst?: boolean;
  // Called after an item is swiped away, with a way to put it back (the screen shows an Undo bar)
  onDeleted?: (undo: () => void) => void;
  // The screen's own "Add item" button (pinned at the bottom) calls this; it adds a new item at the top
  addRef?: { current: (() => void) | null };
};

// Unticked items first (drag the handle to reorder, swipe sideways to delete); ticked ones fold into their own section below
export function ChecklistEditor({ items, onChange, autoFocusFirst, onDeleted, addRef }: Props) {
  const { c } = useTheme();
  const refs = useRef(new Map<string, Focusable | null>());
  // Always the newest list, so Undo works even after more edits
  const latest = useRef(items);
  latest.current = items;
  const [focusId, setFocusId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(true);

  const open = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);

  const update = (id: string, patch: Partial<ChecklistItem>) => onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const focusLater = (id: string) => setTimeout(() => refs.current.get(id)?.focus(), 30);

  // Enter: add a new item right after this one. With no item given, add at the very top.
  const insertAfter = (id: string | null) => {
    const cur = latest.current;
    const item = { id: newId(), text: '', done: false };
    const at = id ? cur.findIndex((i) => i.id === id) + 1 : 0;
    onChange([...cur.slice(0, at), item, ...cur.slice(at)]);
    focusLater(item.id);
  };
  if (addRef) addRef.current = () => insertAfter(null);

  // Backspace on an empty item: remove it and go to the previous one
  const removeIfEmpty = (id: string) => {
    const idx = open.findIndex((i) => i.id === id);
    if (open[idx]?.text) return;
    onChange(items.filter((i) => i.id !== id));
    const prev = open[idx - 1];
    if (prev) focusLater(prev.id);
  };

  // Swipe to delete: remove now, and offer Undo that puts it back in the same place
  const remove = (it: ChecklistItem) => {
    const at = latest.current.findIndex((i) => i.id === it.id);
    if (at < 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onChange(latest.current.filter((i) => i.id !== it.id));
    onDeleted?.(() => {
      const cur = latest.current.filter((i) => i.id !== it.id);
      onChange([...cur.slice(0, at), it, ...cur.slice(at)]);
    });
  };

  const toggle = (it: ChecklistItem) => {
    Haptics.selectionAsync().catch(() => {});
    update(it.id, { done: !it.done });
  };

  // --- Drag to reorder (unticked items) ---
  const layouts = useRef(new Map<string, { y: number; h: number }>());
  const [drag, setDrag] = useState<{ id: string; from: number; to: number } | null>(null);
  const dragY = useSharedValue(0);

  const onRowLayout = useCallback((id: string, e: LayoutChangeEvent) => {
    layouts.current.set(id, { y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height });
  }, []);

  const startDrag = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const from = open.findIndex((i) => i.id === id);
    setDrag({ id, from, to: from });
  };

  // Where would the dragged row land, given how far it has moved?
  const moveDrag = (dy: number) => {
    setDrag((d) => {
      if (!d) return d;
      const me = layouts.current.get(d.id);
      if (!me) return d;
      const centre = me.y + me.h / 2 + dy;
      // New index = how many of the other rows sit above the dragged row's centre
      let to = 0;
      for (const it of open) {
        if (it.id === d.id) continue;
        const l = layouts.current.get(it.id);
        if (l && centre > l.y + l.h / 2) to += 1;
      }
      return to === d.to ? d : { ...d, to };
    });
  };

  const endDrag = () => {
    setDrag((d) => {
      if (d && d.to !== d.from) {
        const reordered = [...open];
        const [moved] = reordered.splice(d.from, 1);
        reordered.splice(d.to, 0, moved);
        onChange([...reordered, ...done]);
        Haptics.selectionAsync().catch(() => {});
      }
      return null;
    });
    dragY.value = 0;
  };

  // How far each non-dragged row slides to make room
  const shiftFor = (index: number) => {
    if (!drag) return 0;
    const h = layouts.current.get(drag.id)?.h ?? 48;
    if (drag.from < drag.to && index > drag.from && index <= drag.to) return -h;
    if (drag.from > drag.to && index >= drag.to && index < drag.from) return h;
    return 0;
  };

  const row = (it: ChecklistItem, index: number, draggable: boolean) => (
    <ItemRow
      key={it.id}
      it={it}
      focused={focusId === it.id}
      dragging={drag?.id === it.id}
      shift={draggable ? shiftFor(index) : 0}
      dragY={dragY}
      draggable={draggable && open.length > 1}
      inputRef={(r) => refs.current.set(it.id, r)}
      onLayout={(e) => onRowLayout(it.id, e)}
      onToggle={() => toggle(it)}
      onText={(t) => update(it.id, { text: t.replace(/\n/g, '') })}
      onSubmit={() => insertAfter(it.id)}
      onBackspace={() => removeIfEmpty(it.id)}
      onFocus={() => setFocusId(it.id)}
      onRemove={() => remove(it)}
      onDragStart={() => startDrag(it.id)}
      onDragMove={moveDrag}
      onDragEnd={endDrag}
    />
  );

  return (
    <View>
      <View>{open.map((it, i) => row(it, i, true))}</View>
      {/* Inline button only when the screen doesn't pin its own at the bottom */}
      {addRef ? null : (
        <Pressable onPress={() => insertAfter(null)} style={styles.add} accessibilityRole="button" android_ripple={{ color: c.rule }}>
          <View style={styles.box}>
            <Icon name="plus" color={c.primary} />
          </View>
          <Text style={[type.body, { color: c.primary }]}>Add item</Text>
        </Pressable>
      )}

      {done.length > 0 && (
        <>
          <Pressable onPress={() => setShowDone((s) => !s)} style={[styles.doneHead, { borderTopColor: c.rule }]} accessibilityRole="button" accessibilityState={{ expanded: showDone }}>
            <Icon name={showDone ? 'chevron-down' : 'chevron-right'} color={c.inkMuted} />
            <Text style={[type.label, { color: c.inkMuted, fontVariant: ['tabular-nums'] }]}>{done.length} ticked</Text>
          </Pressable>
          {showDone && done.map((it, i) => row(it, i, false))}
        </>
      )}
      {autoFocusFirst && items.length === 0 ? <AutoAdd onAdd={() => insertAfter(null)} /> : null}
    </View>
  );
}

// One checklist line: drag handle, tick box, text, remove button while editing
type Focusable = { focus: () => void };
type RowProps = {
  it: ChecklistItem; focused: boolean; dragging: boolean; shift: number; draggable: boolean;
  dragY: { value: number };
  inputRef: (r: Focusable | null) => void; onLayout: (e: LayoutChangeEvent) => void;
  onToggle: () => void; onText: (t: string) => void; onSubmit: () => void; onBackspace: () => void; onFocus: () => void; onRemove: () => void;
  onDragStart: () => void; onDragMove: (dy: number) => void; onDragEnd: () => void;
};

const ItemRow = memo(function ItemRow(p: RowProps) {
  const { c, row } = useTheme();
  const { it } = p;
  const rtl = isRTL(it.text);

  // The handle starts a drag straight away; the row follows the finger
  const pan = Gesture.Pan()
    .enabled(p.draggable)
    .minDistance(0)
    .onBegin(() => {
      scheduleOnRN(p.onDragStart);
    })
    .onUpdate((e) => {
      p.dragY.value = e.translationY;
      scheduleOnRN(p.onDragMove, e.translationY);
    })
    .onFinalize(() => {
      scheduleOnRN(p.onDragEnd);
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: p.dragging ? p.dragY.value : withTiming(p.shift, { duration: 160 }) }],
    zIndex: p.dragging ? 10 : 0,
  }));

  // Swipe sideways to delete: past a third of the width (or a quick flick) removes the item
  const tx = useSharedValue(0);
  const width = useSharedValue(360);
  const swipe = Gesture.Pan()
    .activeOffsetX([-16, 16])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      tx.value = e.translationX;
    })
    .onEnd((e) => {
      const far = Math.abs(e.translationX) > width.value / 3 || (Math.abs(e.velocityX) > 900 && Math.abs(e.translationX) > 40);
      if (far) {
        const dir = e.translationX > 0 ? 1 : -1;
        tx.value = withTiming(dir * width.value, { duration: 140 }, (ok) => {
          if (ok) scheduleOnRN(p.onRemove);
        });
      } else {
        tx.value = withTiming(0, { duration: 160 });
      }
    });
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));
  const bin = useAnimatedStyle(() => ({
    opacity: tx.value === 0 ? 0 : 1,
    justifyContent: tx.value > 0 ? 'flex-start' : 'flex-end',
  }));

  return (
    <Animated.View
      onLayout={(e) => {
        width.value = e.nativeEvent.layout.width;
        p.onLayout(e);
      }}
      accessibilityActions={[{ name: 'delete', label: 'Delete item' }]}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === 'delete' && p.onRemove()}
      style={[{ borderBottomWidth: 1, borderBottomColor: c.paperLine }, p.dragging && styles.lifted, style]}>
      {/* Red strip revealed behind the row while swiping */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.bin, { backgroundColor: c.danger }, bin]}>
        <Icon name="delete-outline" size={22} color="#FFFFFF" />
      </Animated.View>
      <GestureDetector gesture={swipe}>
      <Animated.View
        style={[
          styles.row,
          { minHeight: Math.max(48, row.min - 16), backgroundColor: p.dragging ? c.groundAlt : c.ground },
          slide,
        ]}>
      {p.draggable ? (
        <GestureDetector gesture={pan}>
          <View style={styles.handle} accessibilityLabel="Drag to reorder" accessibilityRole="adjustable">
            <Icon name="drag-vertical" size={20} color={c.ruleStrong} />
          </View>
        </GestureDetector>
      ) : (
        <View style={styles.handleSpace} />
      )}
      <Pressable onPress={p.onToggle} hitSlop={4} style={styles.box} accessibilityRole="checkbox" accessibilityState={{ checked: it.done }} accessibilityLabel={it.text || 'Empty item'}>
        <Icon name={it.done ? 'checkbox-marked' : 'checkbox-blank-outline'} color={it.done ? c.primary : c.inkMuted} />
      </Pressable>
      <TextInput
        ref={p.inputRef}
        value={it.text}
        onChangeText={p.onText}
        onSubmitEditing={p.onSubmit}
        onKeyPress={(e) => e.nativeEvent.key === 'Backspace' && p.onBackspace()}
        onFocus={p.onFocus}
        submitBehavior="submit"
        returnKeyType="next"
        multiline
        placeholder="Item"
        placeholderTextColor={c.inkMuted}
        selectionColor={c.primary}
        cursorColor={c.primary}
        style={[
          type.reading,
          styles.input,
          { color: it.done ? c.inkMuted : c.ink, textDecorationLine: it.done ? 'line-through' : 'none', textAlign: rtl ? 'right' : 'left', writingDirection: rtl ? 'rtl' : 'ltr' },
        ]}
      />
      </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
});

// New lists start with an empty item ready to type into
function AutoAdd({ onAdd }: { onAdd: () => void }) {
  const fired = useRef(false);
  if (!fired.current) {
    fired.current = true;
    setTimeout(onAdd, 0);
  }
  return null;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  bin: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space(5) },
  lifted: { elevation: 6, borderRadius: 8 },
  handle: { width: 28, height: 48, alignItems: 'center', justifyContent: 'center', marginLeft: -space(2) },
  handleSpace: { width: 28, marginLeft: -space(2) },
  box: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, paddingVertical: space(2.5), paddingRight: space(2) },
  add: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingLeft: 28 - space(2) },
  doneHead: { flexDirection: 'row', alignItems: 'center', gap: space(2), minHeight: 48, paddingHorizontal: space(3), marginTop: space(4), borderTopWidth: StyleSheet.hairlineWidth },
});
