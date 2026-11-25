import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

// Notebook-paper lines behind a note's text: one line under every line of writing.
// `height` is the area to fill, `lineHeight` the spacing (the text's line height), `offset` where the first line of text starts.
export function RuledLines({ height, lineHeight, offset = 0 }: { height: number; lineHeight: number; offset?: number }) {
  const { c } = useTheme();
  const count = Math.max(0, Math.floor((height - offset) / lineHeight));
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ position: 'absolute', left: 0, right: 0, top: offset + (i + 1) * lineHeight - 1, height: 1, backgroundColor: c.paperLine }} />
      ))}
    </View>
  );
}
