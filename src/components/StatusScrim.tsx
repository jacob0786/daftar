import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

// A strip in the header colour behind the phone's status bar (clock, battery),
// so scrolled content never runs underneath it. Place it last inside a screen's root view.
export function StatusScrim() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  if (!insets.top) return null;
  return <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: c.shell }} />;
}
