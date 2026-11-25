import { NativeTabs } from 'expo-router/native-tabs';

import { useTheme } from '@/theme';

// Material bottom navigation: native on Android
export default function TabsLayout() {
  const { c } = useTheme();
  return (
    <NativeTabs
      backgroundColor={c.groundAlt}
      indicatorColor={c.primaryContainer}
      labelStyle={{ default: { color: c.inkMuted }, selected: { color: c.ink } }}
      iconColor={{ default: c.inkMuted, selected: c.onPrimaryContainer }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Notes</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="event_note" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="calendar">
        <NativeTabs.Trigger.Label>Calendar</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="calendar_month" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="archive">
        <NativeTabs.Trigger.Label>Archive</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="archive" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
