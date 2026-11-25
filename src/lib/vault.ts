import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { getMeta, setMeta } from '@/db/database';
import type { LockedContent } from '@/db/types';
import { exportKeyB64, fromB64, importKey, importKeyB64, open, randomBytes, seal, toB64, type AesKey } from './aes';
import { secureGet, secureGetWithAuth, secureSet, secureSetWithAuth } from './secure';

// Passphrase -> 256-bit key. Salt and a check value are synced, so any device can unlock.
const ITERATIONS = 150_000;
const META_SALT = 'vault.salt';
const META_CHECK = 'vault.check';
const CHECK_TEXT = 'notes-vault-ok';
const SECURE_KEY = 'vault.key';

let cached: AesKey | null = null;

export async function isVaultSetUp() {
  return !!(await getMeta(META_SALT)) && !!(await getMeta(META_CHECK));
}

export function isUnlocked() {
  return cached !== null;
}

export function lockNow() {
  cached = null;
  changed();
}

async function deriveKey(passphrase: string, saltB64: string) {
  const salt = fromB64(saltB64);
  const bytes = await pbkdf2Async(sha256, new TextEncoder().encode(passphrase), salt, { c: ITERATIONS, dkLen: 32 });
  return importKey(bytes);
}

// Remember the key on this phone behind fingerprint / screen lock (desktop never remembers it)
async function rememberKey(key: AesKey) {
  await secureSetWithAuth(SECURE_KEY, await exportKeyB64(key), 'Unlock your locked notes');
  await secureSet(SECURE_KEY + '.exists', '1');
}

// Listeners so screens can react to lock / unlock (e.g. hiding sync settings again)
const listeners = new Set<() => void>();
export function onVaultChange(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
const changed = () => listeners.forEach((fn) => fn());

// Export / restore: the salt and check travel with the file so a new device can unlock with the passphrase
export async function vaultParams() {
  return { salt: await getMeta(META_SALT), check: await getMeta(META_CHECK) };
}

// --- First-time setup on the first device ---
export async function setUpVault(passphrase: string) {
  const salt = toB64(randomBytes(16));
  const key = await deriveKey(passphrase, salt);
  await setMeta(META_SALT, salt, true);
  await setMeta(META_CHECK, await seal(CHECK_TEXT, key), true);
  cached = key;
  await rememberKey(key).catch(() => {});
  changed();
}

// --- Unlock with the passphrase (new device, or fingerprint unavailable) ---
export async function unlockWithPassphrase(passphrase: string): Promise<boolean> {
  const salt = await getMeta(META_SALT);
  const check = await getMeta(META_CHECK);
  if (!salt || !check) return false;
  const key = await deriveKey(passphrase, salt);
  try {
    if ((await open(check, key)) !== CHECK_TEXT) return false;
  } catch {
    return false;
  }
  cached = key;
  await rememberKey(key).catch(() => {});
  changed();
  return true;
}

// --- Unlock with fingerprint / screen lock. Returns false if not set or cancelled. ---
export async function unlockWithBiometrics(): Promise<boolean> {
  try {
    if (!(await hasRememberedKey())) return false;
    const b64 = await secureGetWithAuth(SECURE_KEY, 'Unlock your locked notes');
    if (!b64) return false;
    cached = await importKeyB64(b64);
    changed();
    return true;
  } catch {
    return false;
  }
}

export async function hasRememberedKey() {
  try {
    return (await secureGet(SECURE_KEY + '.exists')) === '1';
  } catch {
    return false;
  }
}

export async function encryptContent(content: LockedContent): Promise<string> {
  if (!cached) throw new Error('Vault is locked');
  return seal(JSON.stringify(content), cached);
}

export async function decryptContent(cipher: string): Promise<LockedContent> {
  if (!cached) throw new Error('Vault is locked');
  return JSON.parse(await open(cipher, cached)) as LockedContent;
}
