import * as SecureStore from 'expo-secure-store';

// Small wrapper over the phone's secure storage (Android Keystore).
// The desktop app swaps this file for secure.web.ts, which uses the operating system's keychain.

export function secureGet(key: string) {
  return SecureStore.getItemAsync(key);
}

export function secureSet(key: string, value: string) {
  return SecureStore.setItemAsync(key, value);
}

export function secureDelete(key: string) {
  return SecureStore.deleteItemAsync(key);
}

// Values that need a fingerprint / screen lock to read
export function secureGetWithAuth(key: string, prompt: string) {
  return SecureStore.getItemAsync(key, { requireAuthentication: true, authenticationPrompt: prompt });
}

export function secureSetWithAuth(key: string, value: string, prompt: string) {
  return SecureStore.setItemAsync(key, value, { requireAuthentication: true, authenticationPrompt: prompt });
}

export const hasBiometrics = true;
