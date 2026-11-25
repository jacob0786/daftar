// AES-256-GCM for locked notes (desktop), using the browser's WebCrypto.
// Same sealed format as the phone: 12-byte IV, then ciphertext, then 16-byte tag, as base64.

export type AesKey = { raw: Uint8Array; key: CryptoKey };

export function randomBytes(n: number) {
  return crypto.getRandomValues(new Uint8Array(n));
}

export async function importKey(bytes: Uint8Array): Promise<AesKey> {
  const raw = new Uint8Array(bytes);
  return { raw, key: await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']) };
}

export function importKeyB64(b64: string) {
  return importKey(fromB64(b64));
}

export async function exportKeyB64(key: AesKey) {
  return toB64(key.raw);
}

export async function seal(text: string, key: AesKey) {
  const iv = randomBytes(12);
  const out = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key.key, new TextEncoder().encode(text)));
  const combined = new Uint8Array(iv.length + out.length);
  combined.set(iv);
  combined.set(out, iv.length);
  return toB64(combined);
}

export async function open(b64: string, key: AesKey) {
  const all = fromB64(b64);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12), tagLength: 128 }, key.key, all.slice(12));
  return new TextDecoder().decode(plain);
}

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
