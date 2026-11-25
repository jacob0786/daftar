import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

// Over-the-air updates: new app code downloads in the background and applies on the next restart.
// Changes that need new native parts (a new permission, a new widget) still need a fresh APK.

export function versionLabel() {
  const v = Constants.expoConfig?.version ?? '';
  const id = Updates.updateId ? ` · update ${Updates.updateId.slice(0, 8)}` : ' · built-in';
  const when = Updates.createdAt ? ` (${Updates.createdAt.toISOString().slice(0, 10)})` : '';
  return `Version ${v}${id}${when}`;
}

export const updatesEnabled = Updates.isEnabled;

// 'none' = up to date, 'ready' = downloaded, restart to use it
export async function checkForUpdate(): Promise<'none' | 'ready' | 'off'> {
  if (!Updates.isEnabled) return 'off';
  const r = await Updates.checkForUpdateAsync();
  if (!r.isAvailable) return 'none';
  await Updates.fetchUpdateAsync();
  return 'ready';
}

export function restartIntoUpdate() {
  return Updates.reloadAsync();
}
