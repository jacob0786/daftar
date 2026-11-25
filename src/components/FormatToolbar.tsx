import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { space, useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';

export type Selection = { start: number; end: number };
type Edit = { text: string; selection: Selection };

// --- Text changes the toolbar makes (pure functions, easy to test) ---

// Wrap the selection in markers, or remove them if already wrapped. With no selection, place the cursor between.
export function wrap(text: string, sel: Selection, mark: string): Edit {
  const before = text.slice(0, sel.start), inside = text.slice(sel.start, sel.end), after = text.slice(sel.end);
  if (before.endsWith(mark) && after.startsWith(mark)) {
    return { text: before.slice(0, -mark.length) + inside + after.slice(mark.length), selection: { start: sel.start - mark.length, end: sel.end - mark.length } };
  }
  return { text: before + mark + inside + mark + after, selection: { start: sel.start + mark.length, end: sel.end + mark.length } };
}

// Add or remove a prefix ("# ", "- ", "1. ", "> ") on every line the selection touches
export function prefixLines(text: string, sel: Selection, prefix: string | ((i: number) => string), match: RegExp): Edit {
  const lineStart = text.lastIndexOf('\n', sel.start - 1) + 1;
  const endIdx = text.indexOf('\n', sel.end);
  const lineEnd = endIdx === -1 ? text.length : endIdx;
  const lines = text.slice(lineStart, lineEnd).split('\n');
  const allHave = lines.every((l) => match.test(l));
  const next = lines.map((l, i) => {
    const stripped = l.replace(/^(#{1,3}\s+|[-*•]\s+|\d+[.)]\s+|>\s?)/, '');
    return allHave ? stripped : (typeof prefix === 'function' ? prefix(i) : prefix) + stripped;
  });
  const block = next.join('\n');
  const delta = block.length - (lineEnd - lineStart);
  return { text: text.slice(0, lineStart) + block + text.slice(lineEnd), selection: { start: Math.max(lineStart, sel.start + (next[0].length - lines[0].length)), end: sel.end + delta } };
}

const TOOLS: { icon: IconName; label: string; apply: (t: string, s: Selection) => Edit }[] = [
  { icon: 'format-bold', label: 'Bold', apply: (t, s) => wrap(t, s, '**') },
  { icon: 'format-italic', label: 'Italic', apply: (t, s) => wrap(t, s, '_') },
  { icon: 'format-strikethrough-variant', label: 'Strikethrough', apply: (t, s) => wrap(t, s, '~~') },
  { icon: 'marker', label: 'Highlight', apply: (t, s) => wrap(t, s, '==') },
  { icon: 'format-header-1', label: 'Heading', apply: (t, s) => prefixLines(t, s, '# ', /^#\s+/) },
  { icon: 'format-header-2', label: 'Subheading', apply: (t, s) => prefixLines(t, s, '## ', /^##\s+/) },
  { icon: 'format-list-bulleted', label: 'Bulleted list', apply: (t, s) => prefixLines(t, s, '- ', /^[-*•]\s+/) },
  { icon: 'format-list-numbered', label: 'Numbered list', apply: (t, s) => prefixLines(t, s, (i) => `${i + 1}. `, /^\d+[.)]\s+/) },
  { icon: 'format-quote-close', label: 'Quote', apply: (t, s) => prefixLines(t, s, '> ', /^>\s?/) },
  { icon: 'minus', label: 'Divider', apply: (t, s) => ({ text: `${t.slice(0, s.start)}\n---\n${t.slice(s.end)}`, selection: { start: s.start + 5, end: s.start + 5 } }) },
];

// Sits above the keyboard while editing a note with formatting on
export function FormatToolbar({ text, selection, onEdit }: { text: string; selection: Selection; onEdit: (e: Edit) => void }) {
  const { c } = useTheme();
  return (
    <View style={[styles.bar, { backgroundColor: c.groundAlt, borderTopColor: c.rule }]}>
      <ScrollView horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {TOOLS.map((t) => (
          <Pressable
            key={t.label}
            onPress={() => onEdit(t.apply(text, selection))}
            style={styles.btn}
            accessibilityRole="button"
            accessibilityLabel={t.label}
            android_ripple={{ color: c.rule, borderless: true, radius: 22 }}>
            <Icon name={t.icon} size={22} color={c.ink} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: StyleSheet.hairlineWidth },
  row: { paddingHorizontal: space(2), gap: space(1) },
  btn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
