import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { SORTS } from '@/components/FilterChips';
import { Icon, type IconName } from '@/components/Icon';
import { ShellHeader } from '@/components/ShellHeader';
import { countByStatus, getColorNames } from '@/db/database';
import type { ColorIndex } from '@/db/types';
import { useSyncState } from '@/hooks/useNotes';
import { importNotes, preview, readExport, type ImportPreview } from '@/import/colornote';
import { backupFileName, buildBackup, readBackup, restoreBackup, type Backup } from '@/lib/backup';
import { hijri, relativeTime } from '@/lib/dates';
import { setPref } from '@/lib/prefs';
import { hasBiometrics } from '@/lib/secure';
import { shareTextFile } from '@/lib/share';
import { checkForUpdate, restartIntoUpdate, updatesEnabled, versionLabel } from '@/lib/updates';
import { isUnlocked, isVaultSetUp, lockNow, onVaultChange, setUpVault, unlockWithBiometrics, unlockWithPassphrase } from '@/lib/vault';
import { syncInBackground } from '@/sync/scheduler';
import { clearCredentials, getCredentials, saveCredentials, testConnection } from '@/sync/turso';
import { ACCENT_LIST, COLOR_NAMES, space, type, useTheme } from '@/theme';

type Msg = { ok: boolean; text: string } | null;

export default function SettingsScreen() {
  const { c, ink, prefs, isDark } = useTheme();
  const router = useRouter();
  const sync = useSyncState();

  // --- Lock ---
  const [vault, setVault] = useState<'none' | 'locked' | 'unlocked'>('none');
  const [pass1, setPass1] = useState('');
  const [pass2, setPass2] = useState('');
  const [lockMsg, setLockMsg] = useState<Msg>(null);
  const [deriving, setDeriving] = useState(false);
  const refreshVault = async () => setVault(!(await isVaultSetUp()) ? 'none' : isUnlocked() ? 'unlocked' : 'locked');
  useEffect(() => {
    refreshVault();
    return onVaultChange(refreshVault);
  }, []);

  // --- Turso ---
  const [connected, setConnected] = useState(false);
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [tursoMsg, setTursoMsg] = useState<Msg>(null);
  const [testing, setTesting] = useState(false);

  // --- Backup / import ---
  const [pending, setPending] = useState<{ data: Awaited<ReturnType<typeof readExport>>; info: ImportPreview } | null>(null);
  const [backup, setBackup] = useState<Backup | null>(null);
  const [fileMsg, setFileMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // --- Other ---
  const [counts, setCounts] = useState({ active: 0, archived: 0, trash: 0 });
  const [colorNames, setColorNames] = useState<(string | null)[]>(Array(9).fill(null));
  const [update, setUpdate] = useState<'idle' | 'checking' | 'none' | 'ready' | 'error'>('idle');

  useEffect(() => {
    getCredentials().then((cr) => {
      setConnected(!!cr);
      if (cr) setUrl(cr.url);
    });
    countByStatus().then(setCounts);
    getColorNames().then(setColorNames);
  }, [busy]);

  // Sync connection details sit behind the same lock as locked notes
  const syncHidden = vault === 'locked';

  const connect = async () => {
    setTesting(true);
    setTursoMsg(null);
    try {
      await testConnection(url, token);
      await saveCredentials(url, token);
      setConnected(true);
      setToken('');
      setTursoMsg({ ok: true, text: 'Connected. Your notes are syncing now.' });
      syncInBackground();
    } catch (e) {
      setTursoMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't reach Turso. Check the address and token." });
    } finally {
      setTesting(false);
    }
  };

  const setUpLock = async () => {
    if (pass1.length < 8) return setLockMsg({ ok: false, text: 'Use at least 8 characters. A short phrase is easiest to remember.' });
    if (pass1 !== pass2) return setLockMsg({ ok: false, text: "The two passphrases don't match." });
    setDeriving(true);
    await setUpVault(pass1);
    setDeriving(false);
    setPass1('');
    setPass2('');
    setLockMsg({ ok: true, text: hasBiometrics ? 'Locking is ready. Your fingerprint now opens locked notes on this device.' : 'Locking is ready.' });
    syncInBackground();
  };

  const unlock = async () => {
    setDeriving(true);
    const ok = await unlockWithPassphrase(pass1);
    setDeriving(false);
    setPass1('');
    setLockMsg(ok ? { ok: true, text: hasBiometrics ? 'Unlocked. Fingerprint will work from now on.' : 'Unlocked.' } : { ok: false, text: "That passphrase doesn't match." });
  };

  // --- Files ---
  const exportAll = async () => {
    setFileMsg(null);
    setBusy('Preparing…');
    try {
      await shareTextFile(backupFileName(), await buildBackup());
      setFileMsg({ ok: true, text: 'Backup ready. Locked notes stay encrypted in the file; your passphrase opens them.' });
    } catch (e) {
      setFileMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't make the backup." });
    } finally {
      setBusy(null);
    }
  };

  const pickFile = async (kind: 'colornote' | 'backup') => {
    setFileMsg(null);
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true });
    if (res.canceled) return;
    try {
      if (kind === 'backup') setBackup(await readBackup(res.assets[0].uri));
      else {
        const data = await readExport(res.assets[0].uri);
        setPending({ data, info: preview(data) });
      }
    } catch (e) {
      setFileMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't read that file." });
    }
  };

  const runImport = async () => {
    if (!pending) return;
    try {
      setBusy('Importing…');
      const n = await importNotes(pending.data, (d) => setBusy(`Importing… ${d}`));
      setFileMsg({ ok: true, text: `Imported ${n} notes with their dates, colours and ticks.` });
      setPending(null);
      syncInBackground();
    } catch (e) {
      setFileMsg({ ok: false, text: e instanceof Error ? e.message : 'Import failed. Nothing was changed.' });
    } finally {
      setBusy(null);
    }
  };

  const runRestore = async () => {
    if (!backup) return;
    try {
      setBusy('Restoring…');
      const n = await restoreBackup(backup, (d) => setBusy(`Restoring… ${d}`));
      setFileMsg({ ok: true, text: n ? `Restored ${n} notes. Notes you already had in a newer version were kept.` : 'Everything in that backup is already here.' });
      setBackup(null);
      syncInBackground();
    } catch (e) {
      setFileMsg({ ok: false, text: e instanceof Error ? e.message : 'Restore failed.' });
    } finally {
      setBusy(null);
    }
  };

  const checkUpdates = async () => {
    setUpdate('checking');
    try {
      const r = await checkForUpdate();
      setUpdate(r === 'ready' ? 'ready' : r === 'none' ? 'none' : 'error');
    } catch {
      setUpdate('error');
    }
  };

  const syncLine =
    sync.kind === 'syncing' ? 'Syncing now…'
    : sync.kind === 'ok' ? `Last synced ${relativeTime(sync.at)}`
    : sync.kind === 'error' ? sync.message
    : 'Not connected. Notes are stored on this device only.';

  return (
    <ScrollView style={{ backgroundColor: c.ground }} contentContainerStyle={{ paddingBottom: space(10) }} keyboardShouldPersistTaps="handled">
      <ShellHeader title="Settings" sub={`${counts.active} notes · ${counts.archived} archived · ${counts.trash} in trash`} />

      {/* Appearance */}
      <Section icon="palette-outline" title="Appearance">
        <Choice label="Theme" value={prefs.theme} onChange={(v) => setPref('theme', v)} options={[{ id: 'system', label: 'System' }, { id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }]} />
        <View style={{ gap: space(2) }}>
          <Text style={[type.labelSmall, { color: c.inkMuted }]}>Colour</Text>
          <View style={styles.swatches}>
            {ACCENT_LIST.map((a) => (
              <Pressable key={a.id} onPress={() => setPref('accent', a.id)} accessibilityRole="radio" accessibilityState={{ selected: prefs.accent === a.id }} accessibilityLabel={a.name} style={styles.swatchWrap}>
                <View style={[styles.swatch, { backgroundColor: a.swatch, borderColor: prefs.accent === a.id ? c.gold : 'transparent' }]}>
                  {prefs.accent === a.id ? <Icon name="check" size={20} color="#FFFFFF" /> : null}
                </View>
                <Text style={[type.labelSmall, { color: c.inkMuted }]} numberOfLines={1}>{a.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        {isDark || prefs.theme === 'dark' ? <Toggle label="Pure black background" hint="Darker, and saves battery on OLED screens" value={prefs.trueBlack} onChange={(v) => setPref('trueBlack', v)} /> : null}
        <Choice label="Text size" value={prefs.fontSize} onChange={(v) => setPref('fontSize', v)} options={[{ id: 'small', label: 'Small' }, { id: 'default', label: 'Default' }, { id: 'large', label: 'Large' }, { id: 'larger', label: 'Larger' }]} />
        <Choice label="Row height" value={prefs.rowHeight} onChange={(v) => setPref('rowHeight', v)} options={[{ id: 'compact', label: 'Compact' }, { id: 'comfortable', label: 'Comfortable' }, { id: 'roomy', label: 'Roomy' }]} />
        <Choice label="List style" value={prefs.view} onChange={(v) => setPref('view', v)} options={[{ id: 'timetable', label: 'Timetable' }, { id: 'simple', label: 'Simple' }]} />
      </Section>

      {/* Notes */}
      <Section icon="note-text-outline" title="Notes">
        <Choice label="Sort notes by" value={prefs.defaultSort} onChange={(v) => setPref('defaultSort', v)} options={SORTS.map((s) => ({ id: s.id, label: s.label }))} wrap />
        <View style={{ gap: space(2) }}>
          <Text style={[type.labelSmall, { color: c.inkMuted }]}>Colour for new notes</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.swatches}>
            <ColorDot label="None" on={prefs.defaultColor === null} fill={c.ground} onPress={() => setPref('defaultColor', null)} />
            {COLOR_NAMES.map((name, i) => (
              <ColorDot key={name} label={colorNames[i] ?? name} on={prefs.defaultColor === i} fill={ink(i as ColorIndex)} onPress={() => setPref('defaultColor', i as ColorIndex)} />
            ))}
          </ScrollView>
        </View>
        <Toggle label="Suggest dates" hint="When a note mentions a date, offer to put it on the calendar" value={prefs.detectDates} onChange={(v) => setPref('detectDates', v)} />
        <Toggle label="Show Hijri date" hint={hijri(new Date(), prefs.hijriAdjust).english} value={prefs.showHijri} onChange={(v) => setPref('showHijri', v)} />
        {prefs.showHijri ? (
          <View style={styles.stepper}>
            <Text style={[type.bodySmall, { color: c.inkMuted, flex: 1 }]}>Match your masjid</Text>
            <Button label="−1 day" onPress={() => setPref('hijriAdjust', Math.max(-2, prefs.hijriAdjust - 1))} disabled={prefs.hijriAdjust <= -2} />
            <Text style={[type.titleMedium, { color: c.ink, fontVariant: ['tabular-nums'], minWidth: 32, textAlign: 'center' }]}>{prefs.hijriAdjust > 0 ? `+${prefs.hijriAdjust}` : prefs.hijriAdjust}</Text>
            <Button label="+1 day" onPress={() => setPref('hijriAdjust', Math.min(2, prefs.hijriAdjust + 1))} disabled={prefs.hijriAdjust >= 2} />
          </View>
        ) : null}
      </Section>

      {/* Sync */}
      <Section icon="cloud-sync-outline" title="Sync with Turso" status={syncLine} statusTone={sync.kind === 'error' ? 'bad' : 'plain'}>
        {connected ? <Button label="Sync now" icon="sync" onPress={syncInBackground} filled /> : null}
        <Toggle label="Sync when the app opens" value={prefs.syncOnLaunch} onChange={(v) => setPref('syncOnLaunch', v)} />
        {syncHidden ? (
          <View style={{ gap: space(2) }}>
            <Text style={[type.bodySmall, { color: c.inkMuted }]}>Connection details are locked. Unlock to change or disconnect.</Text>
            <Button label="Unlock" icon={hasBiometrics ? 'fingerprint' : 'lock-open-variant-outline'} onPress={() => unlockWithBiometrics()} />
          </View>
        ) : connected ? (
          <View style={{ gap: space(2) }}>
            <Text style={[type.bodySmall, { color: c.inkMuted }]} numberOfLines={1}>{url.replace(/^(libsql|https?):\/\//, '')}</Text>
            <Button label="Disconnect" onPress={async () => { await clearCredentials(); setConnected(false); syncInBackground(); }} />
          </View>
        ) : (
          <>
            <Field label="Database address" value={url} onChange={setUrl} placeholder="notes-yourname.turso.io" />
            <Field label="Auth token" value={token} onChange={setToken} placeholder="Paste the token from Turso" secure />
            <Text style={[type.bodySmall, { color: c.inkMuted }]}>Both are kept in this device's secure storage and only ever sent to Turso.</Text>
            <Button label={testing ? 'Checking…' : 'Connect'} icon="link-variant" onPress={connect} filled disabled={!url || !token || testing} />
          </>
        )}
        {tursoMsg && <Message {...tursoMsg} />}
      </Section>

      {/* Lock */}
      <Section icon="lock-outline" title="Lock" status={vault === 'none' ? 'Not set up' : vault === 'unlocked' ? 'Unlocked on this device' : 'Locked'}>
        {vault === 'none' ? (
          <>
            <Text style={[type.bodySmall, { color: c.inkMuted }]}>
              Locked notes are encrypted with a passphrase before they're saved or synced. The lock also guards your sync settings. It can't be recovered if you forget it.
            </Text>
            <Field label="Lock passphrase" value={pass1} onChange={setPass1} secure />
            <Field label="Type it again" value={pass2} onChange={setPass2} secure />
            <Button label={deriving ? 'Setting up…' : 'Set up locking'} icon="shield-lock-outline" onPress={setUpLock} filled disabled={deriving} />
          </>
        ) : vault === 'locked' ? (
          <>
            {hasBiometrics ? <Button label="Unlock with fingerprint" icon="fingerprint" onPress={() => unlockWithBiometrics()} filled /> : null}
            <Field label="Lock passphrase" value={pass1} onChange={setPass1} secure />
            <Button label={deriving ? 'Unlocking…' : 'Unlock with passphrase'} icon="lock-open-variant-outline" onPress={unlock} disabled={!pass1 || deriving} />
          </>
        ) : (
          <Button label="Lock now" icon="lock" onPress={() => lockNow()} />
        )}
        {lockMsg && <Message {...lockMsg} />}
      </Section>

      {/* Backup */}
      <Section icon="file-export-outline" title="Backup and import" status={busy ?? 'One file with every note, tag and colour name'}>
        {backup ? (
          <>
            <Text style={[type.body, { color: c.ink }]}>
              Backup from {backup.exportedAt.slice(0, 10)}: {backup.notes.length} notes, {backup.notes.filter((n) => n.locked).length} locked.
            </Text>
            <View style={styles.rowButtons}>
              <Button label={busy ?? 'Restore'} icon="backup-restore" onPress={runRestore} filled disabled={!!busy} />
              <Button label="Cancel" onPress={() => setBackup(null)} />
            </View>
          </>
        ) : pending ? (
          <>
            <Text style={[type.body, { color: c.ink }]}>
              {pending.info.total} ColorNote notes: {pending.info.text} notes and {pending.info.lists} lists, {pending.info.archived} archived, {pending.info.trash} in trash, {pending.info.locked} locked.
            </Text>
            {pending.info.locked > 0 && vault !== 'unlocked' ? <Message ok={false} text="Set up or unlock the lock above first, so the locked notes arrive locked." /> : null}
            <View style={styles.rowButtons}>
              <Button label={busy ?? `Import ${pending.info.total} notes`} icon="check" onPress={runImport} filled disabled={!!busy || (pending.info.locked > 0 && vault !== 'unlocked')} />
              <Button label="Cancel" onPress={() => setPending(null)} />
            </View>
          </>
        ) : (
          <View style={styles.rowButtons}>
            <Button label="Export all notes" icon="export-variant" onPress={exportAll} filled disabled={!!busy} />
            <Button label="Restore a backup" icon="backup-restore" onPress={() => pickFile('backup')} />
            <Button label="Import from ColorNote" icon="tray-arrow-down" onPress={() => pickFile('colornote')} />
          </View>
        )}
        {fileMsg && <Message {...fileMsg} />}
      </Section>

      {/* Trash */}
      <Pressable onPress={() => router.push('/trash')} android_ripple={{ color: c.rule }} accessibilityRole="button" style={[styles.linkRow, { borderBottomColor: c.rule }]}>
        <Icon name="delete-outline" color={c.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[type.titleMedium, { color: c.ink }]}>Trash</Text>
          <Text style={[type.bodySmall, { color: c.inkMuted }]}>{counts.trash} {counts.trash === 1 ? 'note' : 'notes'} · restore or delete for good</Text>
        </View>
        <Icon name="chevron-right" color={c.ruleStrong} />
      </Pressable>

      {/* About */}
      <Section icon="information-outline" title="Daftar" status={versionLabel()}>
        {updatesEnabled ? (
          update === 'ready' ? (
            <Button label="Restart to update" icon="restart" onPress={restartIntoUpdate} filled />
          ) : (
            <Button
              label={update === 'checking' ? 'Checking…' : update === 'none' ? 'Up to date' : update === 'error' ? 'Check failed, try again' : 'Check for updates'}
              icon="update"
              onPress={checkUpdates}
              disabled={update === 'checking'}
            />
          )
        ) : null}
      </Section>
    </ScrollView>
  );
}

// --- Small building blocks for this screen ---
function Section({ icon, title, status, statusTone = 'plain', children }: { icon: IconName; title: string; status?: string; statusTone?: 'plain' | 'bad'; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={[styles.section, { borderBottomColor: c.rule }]}>
      <View style={styles.sectionHead}>
        <Icon name={icon} color={c.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[type.titleMedium, { color: c.ink }]} accessibilityRole="header">{title}</Text>
          {status ? <Text style={[type.bodySmall, { color: statusTone === 'bad' ? c.danger : c.inkMuted }]}>{status}</Text> : null}
        </View>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Button({ label, icon, onPress, filled, disabled }: { label: string; icon?: IconName; onPress: () => void; filled?: boolean; disabled?: boolean }) {
  const { c } = useTheme();
  const fg = filled ? c.onPrimary : c.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      android_ripple={{ color: filled ? 'rgba(255,255,255,0.2)' : c.rule }}
      style={[styles.button, filled ? { backgroundColor: c.primary } : { borderColor: c.ruleStrong, borderWidth: 1 }, disabled && { opacity: 0.45 }]}>
      {icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <Text style={[type.label, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

// Segmented choice (Material segmented button)
function Choice<T extends string>({ label, value, options, onChange, wrap }: { label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; wrap?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: space(2) }}>
      <Text style={[type.labelSmall, { color: c.inkMuted }]}>{label}</Text>
      <View style={[styles.segments, wrap && styles.segmentsWrap, !wrap && { borderColor: c.ruleStrong }]} accessibilityRole="radiogroup">
        {options.map((o, i) => {
          const on = o.id === value;
          return (
            <Pressable
              key={o.id}
              onPress={() => onChange(o.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              android_ripple={{ color: c.rule }}
              style={[
                wrap ? [styles.pill, { borderColor: on ? c.primaryContainer : c.ruleStrong }] : styles.segment,
                !wrap && i > 0 && { borderLeftWidth: 1, borderLeftColor: c.ruleStrong },
                on && { backgroundColor: c.primaryContainer },
              ]}>
              {on ? <Icon name="check" size={16} color={c.onPrimaryContainer} /> : null}
              <Text style={[type.label, { color: on ? c.onPrimaryContainer : c.ink }]} numberOfLines={1}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={() => onChange(!value)} style={styles.toggle} accessibilityRole="switch" accessibilityState={{ checked: value }}>
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { color: c.ink }]}>{label}</Text>
        {hint ? <Text style={[type.bodySmall, { color: c.inkMuted }]}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: c.primary, false: c.ruleStrong }} thumbColor={value ? c.onPrimary : c.inkMuted} />
    </Pressable>
  );
}

function ColorDot({ label, on, fill, onPress }: { label: string; on: boolean; fill: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={label} style={styles.swatchWrap}>
      <View style={[styles.colorDot, { backgroundColor: fill, borderColor: on ? c.primary : c.ruleStrong, borderWidth: on ? 3 : 1 }]}>
        {label === 'None' && !on ? <Icon name="close" size={16} color={c.inkMuted} /> : null}
      </View>
      <Text style={[type.labelSmall, { color: c.inkMuted, maxWidth: 56 }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function Message({ ok, text }: { ok: boolean; text: string }) {
  const { c } = useTheme();
  return (
    <View style={styles.message}>
      <Icon name={ok ? 'check-circle-outline' : 'alert-circle-outline'} size={18} color={ok ? c.primary : c.danger} />
      <Text style={[type.bodySmall, { color: ok ? c.ink : c.danger, flex: 1 }]}>{text}</Text>
    </View>
  );
}

// Text field kept outside the screen so typing never loses focus
function Field({ label, value, onChange, placeholder, secure }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; secure?: boolean }) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: space(1) }}>
      <Text style={[type.labelSmall, { color: focused ? c.primary : c.inkMuted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.inkMuted}
        secureTextEntry={secure}
        autoCapitalize="none"
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        selectionColor={c.primary}
        cursorColor={c.primary}
        style={[type.body, styles.input, { color: c.ink, borderColor: focused ? c.primary : c.ruleStrong, borderWidth: focused ? 2 : 1 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: space(5), paddingVertical: space(5), borderBottomWidth: StyleSheet.hairlineWidth, gap: space(4) },
  sectionHead: { flexDirection: 'row', gap: space(4), alignItems: 'flex-start' },
  sectionBody: { gap: space(4), paddingLeft: space(10), maxWidth: 680 },
  rowButtons: { flexDirection: 'row', gap: space(2), flexWrap: 'wrap' },
  button: { height: 40, borderRadius: 20, paddingHorizontal: space(5), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space(2), alignSelf: 'flex-start', overflow: 'hidden' },
  input: { borderRadius: 4, paddingHorizontal: space(4), height: 52 },
  message: { flexDirection: 'row', gap: space(2), alignItems: 'flex-start' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  segments: { flexDirection: 'row', borderWidth: 1, borderRadius: 20, overflow: 'hidden', alignSelf: 'stretch' },
  segmentsWrap: { borderWidth: 0, flexWrap: 'wrap', gap: space(2), borderRadius: 0 },
  segment: { flex: 1, minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space(1), paddingHorizontal: space(2) },
  pill: { height: 36, borderRadius: 8, borderWidth: 1, paddingHorizontal: space(3), flexDirection: 'row', alignItems: 'center', gap: space(1.5), overflow: 'hidden' },
  swatches: { flexDirection: 'row', gap: space(2) },
  swatchWrap: { alignItems: 'center', gap: space(1), width: 64 },
  swatch: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  colorDot: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: 48 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: space(4), paddingHorizontal: space(5), minHeight: 72, borderBottomWidth: StyleSheet.hairlineWidth },
});
