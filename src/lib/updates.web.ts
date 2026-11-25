// Desktop: the app updates by installing a new version of the desktop app
declare const __DAFTAR_VERSION__: string | undefined;

export function versionLabel() {
  return `Desktop version ${typeof __DAFTAR_VERSION__ === 'string' ? __DAFTAR_VERSION__ : '1.0.0'}`;
}
export const updatesEnabled = false;
export async function checkForUpdate(): Promise<'none' | 'ready' | 'off'> {
  return 'off';
}
export async function restartIntoUpdate() {
  window.location.reload();
}
