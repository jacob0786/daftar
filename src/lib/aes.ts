import * as Crypto from 'expo-crypto';

// AES-256-GCM for locked notes (phone). Sealed format: 12-byte IV, then ciphertext, then 16-byte tag, as base64.
// aes.web.ts produces the identical format with the browser's WebCrypto, so phone and desktop read each other's notes.

export type AesKey = Crypto.AESEncryptionKey;

export function randomBytes(n: number) {
  return Crypto.getRandomBytes(n);
}

export function importKey(bytes: Uint8Array) {
  return Crypto.AESEncryptionKey.import(bytes);
}

export function importKeyB64(b64: string) {
  return Crypto.AESEncryptionKey.import(b64, 'base64');
}

export function exportKeyB64(key: AesKey) {
  return key.encoded('base64');
}

export async function seal(text: string, key: AesKey) {
  const sealed = await Crypto.aesEncryptAsync(new TextEncoder().encode(text), key);
  return sealed.combined('base64');
}

export async function open(b64: string, key: AesKey) {
  const sealed = Crypto.AESSealedData.fromCombined(fromB64(b64));
  const bytes = await Crypto.aesDecryptAsync(sealed, key, { output: 'bytes' });
  return new TextDecoder().decode(bytes);
}

// Base64 <-> bytes using the engine's built-in atob/btoa
export function fromB64(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export function toB64(bytes: Uint8Array) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
