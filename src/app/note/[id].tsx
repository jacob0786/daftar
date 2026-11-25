import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChecklistEditor } from '@/components/ChecklistEditor';
import { DateSheet } from '@/components/DateSheet';
import { Dialog } from '@/components/Dialog';
import { FormatToolbar, type Selection } from '@/components/FormatToolbar';
import { Icon, type IconName } from '@/components/Icon';
import { Markdown } from '@/components/Markdown';
import { OptionsSheet, type SheetAction } from '@/components/OptionsSheet';
import { Snackbar, type SnackMessage } from '@/components/Snackbar';
import { blankNote, deleteForever, getColorNames, getNote, markSeen, newId, saveNote } from '@/db/database';
import type { ColorIndex, Note, NoteStatus } from '@/db/types';
import { useLabels } from '@/hooks/useNotes';
import { longDate, shortDate } from '@/lib/dates';
import { detectDate } from '@/lib/detectDate';
import { isRTL } from '@/lib/text';
import { decryptContent, encryptContent, isUnlocked, isVaultSetUp, unlockWithBiometrics, unlockWithPassphrase } from '@/lib/vault';
import { syncSoon } from '@/sync/scheduler';
import { BAND, space, type, useTheme } from '@/theme';

type Phase = 'loading' | 'locked' | 'ready' | 'missing';

// Changing any of these counts as editing the words, and moves the note's date to now
const CONTENT_KEYS: (keyof Note)[] = ['title', 'body', 'items', 'kind'];

export default function NoteScreen() {
  const { c, ink, isDark, prefs } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; kind?: string; color?: string; label?: string; date?: string }>();
  const labels = useLabels();

  const [note, setNote] = useState<Note | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [sheet, setSheet] = useState(false);
  const [dateSheet, setDateSheet] = useState(false);
  const [colorNames, setColorNames] = useState<(string | null)[]>(Array(9).fill(null));
  const [passphrase, setPassphrase] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [needsVault, setNeedsVault] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reading, setReading] = useState(false); // formatted notes open in reading view
  const [selection, setSelection] = useState<Selection>({ start: 0, end: 0 });
  const [bodyFocused, setBodyFocused] = useState(false);
  const [dismissedSuggestion, setDismissedSuggestion] = useState(false);
  // "Item deleted · Undo" bar for swiped-away list items
  const [snack, setSnack] = useState<SnackMessage>(null);
  const clearSnack = useCallback(() => setSnack(null), []);

  const bodyRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const isNew = useRef(params.id === 'new');
  const latest = useRef<Note | null>(null);
  const changed = useRef(false); // only save when something actually changed
  const savedOnce = useRef(false);

  // --- Load (or create) the note; locked notes need unlocking first ---
  useEffect(() => {
    getColorNames().then(setColorNames);
    (async () => {
      if (params.id === 'new') {
        const color = params.color !== undefined && params.color !== '' ? (Number(params.color) as ColorIndex) : null;
        const n = blankNote(params.kind === 'checklist' ? 'checklist' : 'text', color);
        if (params.label) n.labels = [params.label];
        if (params.date) n.dateAt = Number(params.date);
        latest.current = n;
        setNote(n);
        setPhase('ready');
        return;
      }
      const n = await getNote(params.id);
      if (!n) return setPhase('missing');
      if (!n.seen) markSeen(n.id);
      latest.current = n;
      setNote(n);
      if (n.format === 'rich' && n.body.trim()) setReading(true);
      if (!n.locked) return setPhase('ready');
      if (isUnlocked() || (await unlockWithBiometrics())) await reveal(n);
      else setPhase('locked');
    })();
  }, [params.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const reveal = async (n: Note) => {
    if (!n.cipher) return setPhase('ready');
    const content = await decryptContent(n.cipher);
    const open = { ...n, body: content.body, items: content.items };
    latest.current = open;
    setNote(open);
    if (n.format === 'rich' && open.body.trim()) setReading(true);
    setPhase('ready');
  };

  // --- Save: debounced while typing, and once more on leaving. Opening a note never saves it. ---
  const persist = useCallback(async () => {
    const n = latest.current;
    if (!n || phase !== 'ready' || !changed.current) return;
    const empty = !n.title.trim() && !n.body.trim() && !n.items.some((i) => i.text.trim());
    if (isNew.current && empty && !savedOnce.current) return;
    changed.current = false;
    const toSave = n.locked && isUnlocked() ? { ...n, cipher: await encryptContent({ body: n.body, items: n.items }) } : n;
    const saved = await saveNote(toSave);
    latest.current = { ...latest.current!, updatedAt: saved.updatedAt };
    savedOnce.current = true;
    syncSoon();
  }, [phase]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const edit = (patch: Partial<Note>) => {
    if (!latest.current) return;
    const words = CONTENT_KEYS.some((k) => k in patch);
    const next = { ...latest.current, ...patch, ...(words ? { editedAt: Date.now() } : {}) };
    latest.current = next;
    changed.current = true;
    setNote(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(persist, 600);
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    persist();
  }, [persist]);

  // A date mentioned in the note, offered once as a suggestion
  const suggestion = useMemo(() => {
    if (!note || note.dateAt || !prefs.detectDates || dismissedSuggestion || note.locked && phase !== 'ready') return null;
    const text = [note.title, note.body, ...note.items.map((i) => i.text)].join('\n');
    return detectDate(text, new Date(note.createdAt));
  }, [note?.title, note?.body, note?.items, note?.dateAt, prefs.detectDates, dismissedSuggestion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Actions that change where the note lives save immediately and close
  const moveTo = async (status: NoteStatus) => {
    setSheet(false);
    edit({ status });
    await persist();
    router.back();
  };

  const toggleLock = async () => {
    if (!note) return;
    if (!note.locked) {
      if (!(await isVaultSetUp())) return setNeedsVault(true);
      if (!isUnlocked() && !(await unlockWithBiometrics())) return setNeedsVault(true);
    }
    edit({ locked: !note.locked, cipher: note.locked ? null : note.cipher });
  };

  const convert = () => {
    if (!note) return;
    setSheet(false);
    if (note.kind === 'text') {
      const items = note.body.split('\n').map((t) => t.replace(/^\s*([-*•]|\d+[.)])\s+/, '').trim()).filter(Boolean).map((text) => ({ id: newId(), text, done: false }));
      edit({ kind: 'checklist', items, body: '' });
    } else {
      edit({ kind: 'text', body: note.items.map((i) => i.text).join('\n'), items: [] });
    }
  };

  const share = async () => {
    if (!note) return;
    setSheet(false);
    const text = note.kind === 'checklist' ? note.items.map((i) => `${i.done ? '☑' : '☐'} ${i.text}`).join('\n') : note.body;
    await Share.share({ title: note.title, message: note.title ? `${note.title}\n\n${text}` : text });
  };

  // --- Unlock panel for locked notes ---
  if (phase === 'locked' && note) {
    return (
      <View style={[styles.fill, { backgroundColor: c.ground, paddingTop: insets.top }]}>
        <TopBar onBack={() => router.back()} />
        <View style={styles.lockPanel}>
          <Icon name="lock-outline" size={40} color={c.inkMuted} />
          <Text style={[type.title, { color: c.ink, textAlign: 'center' }]}>{note.title || 'Locked note'}</Text>
          <Text style={[type.bodySmall, { color: c.inkMuted, textAlign: 'center' }]}>Unlock with your fingerprint, or type your lock passphrase.</Text>
          <Pressable onPress={async () => (await unlockWithBiometrics()) ? reveal(note) : setUnlockError('Fingerprint not set up on this device yet. Use your passphrase.')} style={[styles.filled, { backgroundColor: c.primary }]} accessibilityRole="button">
            <Icon name="fingerprint" color={c.onPrimary} />
            <Text style={[type.label, { color: c.onPrimary }]}>Use fingerprint</Text>
          </Pressable>
          <TextInput
            value={passphrase}
            onChangeText={(t) => { setPassphrase(t); setUnlockError(''); }}
            placeholder="Lock passphrase"
            placeholderTextColor={c.inkMuted}
            secureTextEntry
            selectionColor={c.primary}
            cursorColor={c.primary}
            onSubmitEditing={async () => (await unlockWithPassphrase(passphrase)) ? reveal(note) : setUnlockError("That passphrase doesn't match.")}
            style={[type.body, styles.passInput, { color: c.ink, borderColor: unlockError ? c.danger : c.ruleStrong }]}
          />
          {unlockError ? <Text style={[type.bodySmall, { color: c.danger, textAlign: 'center' }]}>{unlockError}</Text> : null}
        </View>
      </View>
    );
  }

  if (phase === 'missing') {
    return (
      <View style={[styles.fill, { backgroundColor: c.ground, paddingTop: insets.top }]}>
        <TopBar onBack={() => router.back()} />
        <View style={styles.lockPanel}>
          <Text style={[type.titleMedium, { color: c.ink }]}>This note was deleted</Text>
        </View>
      </View>
    );
  }

  if (!note || phase === 'loading') return <View style={[styles.fill, { backgroundColor: c.ground }]} />;

  const titleRTL = isRTL(note.title);
  const bodyRTL = isRTL(note.body);
  const rich = note.format === 'rich' && note.kind === 'text';
  const sheetActions: SheetAction[] = [
    { icon: 'calendar-blank-outline', label: note.dateAt ? `Date: ${shortDate(note.dateAt)}` : 'Add a date', onPress: () => { setSheet(false); setDateSheet(true); } },
    ...(note.kind === 'text'
      ? [{ icon: 'format-text' as IconName, label: rich ? 'Turn formatting off' : 'Turn formatting on', onPress: () => { setSheet(false); setReading(false); edit({ format: rich ? 'plain' : 'rich' }); } }]
      : []),
    { icon: note.kind === 'text' ? 'format-list-checks' : 'text-long', label: note.kind === 'text' ? 'Turn into checklist' : 'Turn into note', onPress: convert },
    ...(!note.locked ? [{ icon: 'share-variant-outline' as IconName, label: 'Share', onPress: share }] : []),
    ...(note.status === 'active'
      ? [
          { icon: 'archive-arrow-down-outline' as IconName, label: 'Archive', onPress: () => moveTo('archived') },
          { icon: 'delete-outline' as IconName, label: 'Move to trash', onPress: () => moveTo('trash'), tone: 'danger' as const },
        ]
      : note.status === 'archived'
        ? [
            { icon: 'archive-arrow-up-outline' as IconName, label: 'Unarchive', onPress: () => moveTo('active') },
            { icon: 'delete-outline' as IconName, label: 'Move to trash', onPress: () => moveTo('trash'), tone: 'danger' as const },
          ]
        : [
            { icon: 'restore' as IconName, label: 'Restore', onPress: () => moveTo('active') },
            { icon: 'delete-forever-outline' as IconName, label: 'Delete forever', onPress: () => { setSheet(false); setConfirmDelete(true); }, tone: 'danger' as const },
          ]),
  ];

  return (
    <View style={[styles.fill, { backgroundColor: c.ground, paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <TopBar onBack={() => router.back()}>
        {rich ? <BarButton icon={reading ? 'pencil-outline' : 'eye-outline'} label={reading ? 'Edit' : 'Read'} onPress={() => setReading((r) => !r)} /> : null}
        <BarButton icon={note.pinned ? 'pin' : 'pin-outline'} label={note.pinned ? 'Unpin' : 'Pin'} onPress={() => edit({ pinned: !note.pinned })} />
        <BarButton icon={note.locked ? 'lock' : 'lock-open-variant-outline'} label={note.locked ? 'Unlock note' : 'Lock note'} onPress={toggleLock} />
        <BarButton icon="dots-vertical" label="Colour, tags and more" onPress={() => setSheet(true)} />
      </TopBar>

      <KeyboardAvoidingView behavior="padding" style={styles.fill}>
        <View style={styles.fill}>
          <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: BAND, backgroundColor: ink(note.color) }} />
          <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
            <TextInput
              value={note.title}
              onChangeText={(t) => edit({ title: t.replace(/\n/g, ' ') })}
              placeholder="Title"
              placeholderTextColor={c.inkMuted}
              multiline
              submitBehavior="blurAndSubmit"
              autoFocus={isNew.current && note.kind === 'text'}
              selectionColor={c.primary}
              cursorColor={c.primary}
              style={[type.title, styles.title, { color: c.ink, textAlign: titleRTL ? 'right' : 'left', writingDirection: titleRTL ? 'rtl' : 'ltr' }]}
            />
            <View style={styles.meta}>
              <Text style={[type.labelSmall, { color: c.inkMuted }]}>{isNew.current && !savedOnce.current ? 'New' : `Edited ${longDate(note.editedAt)}`}</Text>
              {note.dateAt ? (
                <Pressable onPress={() => setDateSheet(true)} style={[styles.tag, styles.tagRow, { borderColor: c.ruleStrong }]} accessibilityRole="button" accessibilityLabel={`Date ${shortDate(note.dateAt)}. Change`}>
                  <Icon name="calendar-blank-outline" size={14} color={c.ink} />
                  <Text style={[type.labelSmall, { color: c.ink }]}>{shortDate(note.dateAt)}</Text>
                </Pressable>
              ) : suggestion ? (
                <View style={[styles.tag, styles.tagRow, { borderColor: c.primary, borderStyle: 'dashed' }]}>
                  <Pressable onPress={() => edit({ dateAt: suggestion.at })} style={styles.tagRow} accessibilityRole="button" accessibilityLabel={`Add date ${shortDate(suggestion.at)}, found in "${suggestion.phrase}"`}>
                    <Icon name="calendar-plus" size={14} color={c.primary} />
                    <Text style={[type.labelSmall, { color: c.primary }]}>Add {shortDate(suggestion.at)}?</Text>
                  </Pressable>
                  <Pressable onPress={() => setDismissedSuggestion(true)} hitSlop={10} accessibilityLabel="Ignore suggested date">
                    <Icon name="close" size={14} color={c.inkMuted} />
                  </Pressable>
                </View>
              ) : null}
              {note.labels.map((id) => {
                const l = labels.find((x) => x.id === id);
                return l ? (
                  <Text key={id} style={[type.labelSmall, styles.tag, { color: c.inkMuted, borderColor: c.ruleStrong }]}>{l.name}</Text>
                ) : null;
              })}
              {note.locked ? <Text style={[type.labelSmall, styles.tag, { color: c.inkMuted, borderColor: c.ruleStrong }]}>Locked</Text> : null}
            </View>

            {note.kind === 'checklist' ? (
              <ChecklistEditor
                items={note.items}
                onChange={(items) => edit({ items })}
                autoFocusFirst={isNew.current}
                onDeleted={(undo) => setSnack({ text: 'Item deleted', action: { label: 'Undo', run: undo } })}
              />
            ) : rich && reading ? (
              <Pressable onPress={() => setReading(false)} accessibilityHint="Tap to edit" style={{ minHeight: 240 }}>
                <Markdown text={note.body} />
              </Pressable>
            ) : (
              <TextInput
                value={note.body}
                ref={bodyRef}
                onChangeText={(t) => edit({ body: t })}
                onSelectionChange={rich ? (e) => setSelection(e.nativeEvent.selection) : undefined}
                onFocus={() => setBodyFocused(true)}
                onBlur={() => setBodyFocused(false)}
                placeholder="Note"
                placeholderTextColor={c.inkMuted}
                multiline
                scrollEnabled={false}
                autoFocus={rich && !isNew.current && reading === false && !!note.body}
                selectionColor={c.primary}
                cursorColor={c.primary}
                textAlignVertical="top"
                style={[type.reading, styles.body, { color: c.ink, textAlign: bodyRTL ? 'right' : 'left', writingDirection: bodyRTL ? 'rtl' : 'ltr' }]}
              />
            )}
          </ScrollView>
        </View>
        {rich && !reading && bodyFocused ? (
          <FormatToolbar
            text={note.body}
            selection={selection}
            onEdit={(e) => {
              edit({ body: e.text });
              setSelection(e.selection);
              setTimeout(() => bodyRef.current?.setSelection(e.selection.start, e.selection.end), 0);
            }}
          />
        ) : null}
      </KeyboardAvoidingView>

      <Snackbar message={snack} onDone={clearSnack} bottom={space(4) + insets.bottom} />

      <OptionsSheet
        visible={sheet}
        note={note}
        labels={labels}
        colorNames={colorNames}
        actions={sheetActions}
        onColor={(color) => edit({ color })}
        onToggleLabel={(id) => edit({ labels: note.labels.includes(id) ? note.labels.filter((x) => x !== id) : [...note.labels, id] })}
        onDismiss={() => setSheet(false)}
      />
      <DateSheet
        visible={dateSheet}
        value={note.dateAt}
        onDismiss={() => setDateSheet(false)}
        onPick={(ms) => { setDateSheet(false); edit({ dateAt: ms }); }}
      />

      <Dialog
        visible={needsVault}
        title="Set up locking first"
        body="Choose a lock passphrase in Settings. After that, your fingerprint unlocks locked notes."
        onDismiss={() => setNeedsVault(false)}
        buttons={[
          { label: 'Not now', onPress: () => setNeedsVault(false) },
          { label: 'Open Settings', onPress: () => { setNeedsVault(false); router.push('/settings'); } },
        ]}
      />
      <Dialog
        visible={confirmDelete}
        title="Delete this note forever?"
        body="It'll be removed from this device and your Turso copy. This can't be undone."
        onDismiss={() => setConfirmDelete(false)}
        buttons={[
          { label: 'Cancel', onPress: () => setConfirmDelete(false) },
          { label: 'Delete forever', tone: 'danger', onPress: async () => { await deleteForever([note.id]); latest.current = null; syncSoon(); router.back(); } },
        ]}
      />
    </View>
  );

  function TopBar({ onBack, children }: { onBack: () => void; children?: React.ReactNode }) {
    return (
      <View style={[styles.bar, { borderBottomColor: c.rule }]}>
        <BarButton icon="arrow-left" label="Back" onPress={onBack} />
        <View style={styles.fill} />
        {children}
      </View>
    );
  }

  function BarButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
    return (
      <Pressable onPress={onPress} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={label} android_ripple={{ color: c.rule, borderless: true, radius: 24 }}>
        <Icon name={icon} color={c.ink} />
      </Pressable>
    );
  }
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', height: 64, paddingHorizontal: space(1), borderBottomWidth: StyleSheet.hairlineWidth },
  iconBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  page: { paddingLeft: space(5) + BAND, paddingRight: space(5), paddingTop: space(4), paddingBottom: space(30) },
  title: { paddingVertical: space(1) },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space(2), marginTop: space(1), marginBottom: space(4) },
  tag: { borderWidth: 1, borderRadius: 6, paddingHorizontal: space(1.5), paddingVertical: space(0.5) },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: space(1) },
  body: { minHeight: 240, paddingTop: 0 },
  lockPanel: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space(4), paddingHorizontal: space(8), paddingBottom: space(20) },
  filled: { height: 48, borderRadius: 24, paddingHorizontal: space(6), flexDirection: 'row', alignItems: 'center', gap: space(2) },
  passInput: { alignSelf: 'stretch', borderWidth: 1, borderRadius: 4, paddingHorizontal: space(4), height: 52 },
});
