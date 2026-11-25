// Desktop version of secure storage.
// Inside the Daftar desktop app, values are encrypted by the operating system (Windows DPAPI / macOS Keychain)
// through Electron's safeStorage. In a plain browser it falls back to localStorage.

type DesktopBridge = {
  secureGet: (key: string) => Promise<string | null>;
  secureSet: (key: string, value: string) => Promise<void>;
  secureDelete: (key: string) => Promise<void>;
};

const bridge = (globalThis as { daftarDesktop?: DesktopBridge }).daftarDesktop;

export async function secureGet(key: string) {
  return bridge ? bridge.secureGet(key) : localStorage.getItem(`daftar.${key}`);
}

export async function secureSet(key: string, value: string) {
  if (bridge) return bridge.secureSet(key, value);
  localStorage.setItem(`daftar.${key}`, value);
}

export async function secureDelete(key: string) {
  if (bridge) return bridge.secureDelete(key);
  localStorage.removeItem(`daftar.${key}`);
}

// No fingerprint on desktop: the lock key is never remembered, so locked notes always need the passphrase
export async function secureGetWithAuth(_key: string, _prompt: string): Promise<string | null> {
  return null;
}

export async function secureSetWithAuth(_key: string, _value: string, _prompt: string) {}

export const hasBiometrics = false;
