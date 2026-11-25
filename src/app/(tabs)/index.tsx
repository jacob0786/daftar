import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PromptDialog } from '@/components/Dialog';
import { Fab } from '@/components/Fab';
import { FilterChips, type Filter } from '@/components/FilterChips';
import { Icon } from '@/components/Icon';
import { NoteList, type BulkAction } from '@/components/NoteList';
import { ShellHeader } from '@/components/ShellHeader';
import { StatusScrim } from '@/components/StatusScrim';
import {
  colorCounts, countByStatus, deleteLabel, getColorNames, labelCounts as getLabelCounts, onNotesChanged,
  saveLabel, setColorName, setPinned, setStatus, type SortOrder,
} from '@/db/database';
import type { ColorIndex, Label } from '@/db/types';
import { useLabels, useNotes, useSyncState } from '@/hooks/useNotes';
import { headerDate, hijri, relativeTime } from '@/lib/dates';
import { syncSoon } from '@/sync/scheduler';
import { COLOR_NAMES, space, type, useTheme } from '@/theme';

export default function NotesScreen() {
  const { c, prefs } = useTheme();
  const router = useRouter();
  const sync = useSyncState();
  const labels = useLabels();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [filter, setFilter] = useState<Filter>({});
  const [sort, setSort] = useState<SortOrder>(prefs.defaultSort);
  // Follow the "Sort notes by" setting when it loads or changes
  useEffect(() => setSort(prefs.defaultSort), [prefs.defaultSort]);
  const notes = useNotes({ status: 'active', ...filter, query, sort });
  const searchRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  // Header facts: counts, colours in use, colour names, tag counts
  const [total, setTotal] = useState(0);
  const [colors, setColors] = useState<Map<number, number>>(new Map());
  const [colorNames, setColorNames] = useState<(string | null)[]>(Array(9).fill(null));
  const [tagCounts, setTagCounts] = useState<Map<string, number>>(new Map());
  const [naming, setNaming] = useState<ColorIndex | null>(null);
  const [managing, setManaging] = useState<Label | null>(null);
  useEffect(() => {
    const load = async () => {
      setTotal((await countByStatus()).active);
      setColors(await colorCounts('active'));
      setColorNames(await getColorNames());
      setTagCounts(await getLabelCounts('active'));
    };
    load();
    return onNotesChanged(load);
  }, []);

  // Back closes search before leaving the app
  useEffect(() => {
    if (!searching) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeSearch();
      return true;
    });
    return () => sub.remove();
  }, [searching]);

  const openSearch = () => {
    setSearching(true);
    setTimeout(() => searchRef.current?.focus(), 50);
  };
  const closeSearch = () => {
    setSearching(false);
    setQuery('');
  };

  const now = new Date();
  const h = hijri(now, prefs.hijriAdjust);
  const syncLine =
    sync.kind === 'syncing' ? 'Syncing…'
    : sync.kind === 'ok' ? `Synced ${relativeTime(sync.at)}`
    : sync.kind === 'error' ? 'Not synced, changes are safe on this device'
    : 'On this device only';
  const newParams = { color: filter.color ?? prefs.defaultColor ?? '', label: filter.labelId ?? '' };

  // Archive / trash: used by the selection bar and by swiping a row
  const archiveAction: BulkAction = {
    icon: 'archive-arrow-down-outline',
    label: 'Archive',
    run: async (ids) => {
      await setStatus(ids, 'archived');
      syncSoon();
      return { text: ids.length === 1 ? 'Archived' : `${ids.length} archived`, action: { label: 'Undo', run: () => setStatus(ids, 'active') } };
    },
  };
  const trashAction: BulkAction = {
    icon: 'delete-outline',
    label: 'Move to trash',
    run: async (ids) => {
      await setStatus(ids, 'trash');
      syncSoon();
      return { text: ids.length === 1 ? 'Moved to trash' : `${ids.length} moved to trash`, action: { label: 'Undo', run: () => setStatus(ids, 'active') } };
    },
  };

  return (
    <View style={{ flex: 1 }}>
      <NoteList
        notes={notes}
        sort={sort}
        colorNames={colorNames}
        header={
          <>
            {searching ? (
              <ShellHeader>
                <View style={[styles.search, { backgroundColor: c.shellField }]}>
                  <Pressable onPress={closeSearch} hitSlop={12} accessibilityLabel="Close search">
                    <Icon name="arrow-left" size={22} color={c.onShell} />
                  </Pressable>
                  <TextInput
                    ref={searchRef}
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search notes and lists"
                    placeholderTextColor={c.onShellMuted}
                    selectionColor={c.gold}
                    cursorColor={c.gold}
                    returnKeyType="search"
                    style={[type.body, { flex: 1, color: c.onShell, paddingVertical: 0 }]}
                    accessibilityLabel="Search notes"
                  />
                  {query ? (
                    <Pressable onPress={() => setQuery('')} hitSlop={12} accessibilityLabel="Clear search">
                      <Icon name="close" size={20} color={c.onShellMuted} />
                    </Pressable>
                  ) : null}
                </View>
              </ShellHeader>
            ) : (
              <ShellHeader
                title={headerDate(now)}
                sub={`${total} notes · ${syncLine}`}
                right={
                  prefs.showHijri ? (
                    <Text style={[type.titleMedium, styles.hijri, { color: c.onShell }]} accessibilityLabel={h.english}>{h.arabic}</Text>
                  ) : undefined
                }
              />
            )}
            <FilterChips
              value={filter}
              onChange={setFilter}
              colors={colors}
              colorNames={colorNames}
              labels={labels}
              labelCounts={tagCounts}
              onNameColor={setNaming}
              onManageLabel={setManaging}
              sort={sort}
              onSort={setSort}
            />
          </>
        }
        // Swipe right to archive, left to move to trash
        swipeRight={{ ...archiveAction, color: 'primary' }}
        swipeLeft={{ ...trashAction, color: 'danger' }}
        actions={[
          {
            icon: 'pin-outline',
            label: 'Pin or unpin',
            run: async (ids) => {
              const all = notes ?? [];
              const anyUnpinned = ids.some((id) => !all.find((n) => n.id === id)?.pinned);
              await setPinned(ids, anyUnpinned);
              syncSoon();
            },
          },
          archiveAction,
          trashAction,
        ]}
        empty={
          query || filter.kind || filter.color !== undefined || filter.labelId
            ? { icon: 'text-search', title: 'Nothing matches', body: 'Try fewer words, or clear the filter.' }
            : { icon: 'notebook-outline', title: 'No notes yet', body: 'Tap New to write a note or start a list. You can import your ColorNote notes from Settings.' }
        }
        overlay={
          <>
            {!searching && (
              <Pressable
                onPress={openSearch}
                accessibilityRole="button"
                accessibilityLabel="Search notes"
                android_ripple={{ color: c.rule, borderless: false }}
                style={[styles.searchFab, { backgroundColor: c.groundAlt, borderColor: c.ruleStrong }]}>
                <Icon name="magnify" size={24} color={c.ink} />
              </Pressable>
            )}
            <Fab
              onNote={() => router.push({ pathname: '/note/[id]', params: { id: 'new', kind: 'text', ...newParams } })}
              onList={() => router.push({ pathname: '/note/[id]', params: { id: 'new', kind: 'checklist', ...newParams } })}
              onEvent={() => router.push('/event')}
            />
          </>
        }
      />

      <PromptDialog
        visible={naming !== null}
        title={naming !== null ? `Name the ${COLOR_NAMES[naming].toLowerCase()} tag` : ''}
        body="Name this colour tag after what it's for, like Study or Shopping. Every note in this colour has the tag."
        initial={naming !== null ? colorNames[naming] ?? '' : ''}
        placeholder={naming !== null ? COLOR_NAMES[naming] : ''}
        onDismiss={() => setNaming(null)}
        onSubmit={async (v) => {
          if (naming !== null) await setColorName(naming, v);
          setNaming(null);
          syncSoon();
        }}
      />
      <PromptDialog
        visible={managing !== null}
        title="Rename tag"
        initial={managing?.name ?? ''}
        onDismiss={() => setManaging(null)}
        extra={{
          label: 'Delete',
          tone: 'danger',
          onPress: async () => {
            if (managing) await deleteLabel(managing.id);
            if (filter.labelId === managing?.id) setFilter({});
            setManaging(null);
            syncSoon();
          },
        }}
        onSubmit={async (v) => {
          if (managing && v.trim()) await saveLabel(v, managing.id);
          setManaging(null);
          syncSoon();
        }}
      />
      <StatusScrim />
    </View>
  );
}

const styles = StyleSheet.create({
  hijri: { writingDirection: 'rtl' },
  search: { height: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space(4), gap: space(3) },
  searchFab: { position: 'absolute', left: space(4), bottom: space(4), width: 56, height: 56, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', elevation: 3 },
});
