import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getDb } from '@/db/database';
import { getPrefs, loadPrefs } from '@/lib/prefs';
import { syncInBackground } from '@/sync/scheduler';
import { refreshWidgets } from '@/widgets/refresh';
import { useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  // Open the database and read settings before the first screen draws
  useEffect(() => {
    getDb()
      .then(loadPrefs)
      .finally(() => {
        setReady(true);
        SplashScreen.hideAsync().catch(() => {});
        if (getPrefs().syncOnLaunch) syncInBackground();
      });
    // Sync again whenever the app comes back to the front; refresh widgets when it leaves
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && getPrefs().syncOnLaunch) syncInBackground();
      if (s === 'background' && Platform.OS === 'android') refreshWidgets();
    });
    return () => sub.remove();
  }, []);

  if (!ready) return null;
  return <Shell />;
}

function Shell() {
  const { c, isDark } = useTheme();
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.ground }}>
      <SafeAreaProvider>
        <StatusBar style={isDark ? 'light' : 'light'} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.ground }, animation: 'fade_from_bottom' }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="note/[id]" />
          <Stack.Screen name="trash" />
          <Stack.Screen name="event" />
          <Stack.Screen name="widget-note" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
