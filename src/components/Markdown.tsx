import { Fragment } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';

import { isRTL } from '@/lib/text';
import { space, type, useTheme } from '@/theme';

// --- Reading view for notes with formatting turned on ---
// Supports: # headings, **bold**, _italic_, ~~strike~~, ==highlight==, `code`, - bullets, 1. numbers, > quotes, --- rules

type Span = { text: string; bold?: boolean; italic?: boolean; strike?: boolean; mark?: boolean; code?: boolean };

const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|==[^=]+==|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;

export function parseInline(line: string): Span[] {
  const out: Span[] = [];
  let last = 0;
  for (const m of line.matchAll(INLINE)) {
    if (m.index! > last) out.push({ text: line.slice(last, m.index) });
    const t = m[0];
    if (t.startsWith('**') || t.startsWith('__')) out.push({ text: t.slice(2, -2), bold: true });
    else if (t.startsWith('~~')) out.push({ text: t.slice(2, -2), strike: true });
    else if (t.startsWith('==')) out.push({ text: t.slice(2, -2), mark: true });
    else if (t.startsWith('`')) out.push({ text: t.slice(1, -1), code: true });
    else out.push({ text: t.slice(1, -1), italic: true });
    last = m.index! + t.length;
  }
  if (last < line.length) out.push({ text: line.slice(last) });
  return out;
}

export function Markdown({ text }: { text: string }) {
  const { c, isDark } = useTheme();
  const lines = text.split('\n');

  const inline = (line: string, base: TextStyle) =>
    parseInline(line).map((s, i) => (
      <Text
        key={i}
        style={[
          base,
          s.bold && { fontWeight: '700' },
          s.italic && { fontStyle: 'italic' },
          s.strike && { textDecorationLine: 'line-through', color: c.inkMuted },
          s.mark && { backgroundColor: isDark ? '#5A4A1A' : '#FFE79A' },
          s.code && { fontFamily: 'monospace', backgroundColor: c.groundAlt },
        ]}>
        {s.text}
      </Text>
    ));

  return (
    <View style={{ gap: space(1.5) }}>
      {lines.map((raw, i) => {
        const rtl = isRTL(raw);
        const dir: TextStyle = { textAlign: rtl ? 'right' : 'left', writingDirection: rtl ? 'rtl' : 'ltr' };
        const body: TextStyle = { ...type.reading, color: c.ink, ...dir };

        if (!raw.trim()) return <View key={i} style={{ height: space(2) }} />;
        if (/^-{3,}\s*$/.test(raw)) return <View key={i} style={[styles.rule, { backgroundColor: c.ruleStrong }]} />;

        const h = raw.match(/^(#{1,3})\s+(.*)$/);
        if (h) {
          const size = h[1].length === 1 ? type.title : h[1].length === 2 ? type.rowTitle : type.titleMedium;
          return <Text key={i} style={[size, { color: c.ink, fontWeight: '700', marginTop: space(2), ...dir }]} accessibilityRole="header">{inline(h[2], {})}</Text>;
        }

        const quote = raw.match(/^>\s?(.*)$/);
        if (quote) {
          return (
            <View key={i} style={[styles.quote, { borderColor: c.primary }, rtl && styles.quoteRtl]}>
              <Text style={[body, { color: c.inkMuted, fontStyle: 'italic' }]}>{inline(quote[1], {})}</Text>
            </View>
          );
        }

        const bullet = raw.match(/^(\s*)[-*•]\s+(.*)$/);
        const num = raw.match(/^(\s*)(\d+)[.)]\s+(.*)$/);
        if (bullet || num) {
          const indent = ((bullet?.[1] ?? num?.[1] ?? '').length >= 2 ? 1 : 0) * space(5);
          const marker = bullet ? '•' : `${num![2]}.`;
          const content = bullet ? bullet[2] : num![3];
          return (
            <View key={i} style={[styles.listRow, { flexDirection: rtl ? 'row-reverse' : 'row' }, rtl ? { paddingRight: indent } : { paddingLeft: indent }]}>
              <Text style={[body, styles.marker, { color: c.primary, fontVariant: ['tabular-nums'] }]}>{marker}</Text>
              <Text style={[body, { flex: 1 }]}>{inline(content, {})}</Text>
            </View>
          );
        }

        return (
          <Fragment key={i}>
            <Text style={body} selectable>{inline(raw, {})}</Text>
          </Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rule: { height: StyleSheet.hairlineWidth, marginVertical: space(3) },
  quote: { borderLeftWidth: 1, paddingLeft: space(4), marginLeft: space(1) },
  quoteRtl: { borderLeftWidth: 0, borderRightWidth: 1, paddingLeft: 0, paddingRight: space(4), marginLeft: 0, marginRight: space(1) },
  listRow: { gap: space(2) },
  marker: { minWidth: space(5), textAlign: 'center' },
});
