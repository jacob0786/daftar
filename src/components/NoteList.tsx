import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { markSeen, type SortOrder } from '@/db/database';
import type { Note } from '@/db/types';
import { monthKey, monthLabel, sameDay } from '@/lib/dates';
import { syncInBackground } from '@/sync/scheduler';
import { useSyncState } from '@/hooks/useNotes';
import { COLOR_NAMES, space, type, useTheme } from '@/theme';

const NO_NAMES: (string | null)[] = Array(9).fill(null);
import { Icon, type IconName } from './Icon';
import { NoteRow } from './NoteRow';
import { Snackbar, type SnackMessage } from './Snackbar';
import { SwipeRow, type SwipeSide } from './SwipeRow';

export type BulkAction = { icon: IconName; label: string; run: (ids: string[]) => Promise<SnackMessage | void> };

type Props = {
  notes: Note[] | null;
  header: ReactNode;
  actions: BulkAction[];
  empty: { icon: IconName; title: string; body: string };
  footerSpace?: number;
  overlay?: ReactNode;
  sort?: SortOrder;
  colorNames?: (string | null)[];
  // Swipe a row right / left to run one of these on that note (with the same Undo bar)
  swipeRight?: BulkAction & { color: 'primary' | 'danger' };
  swipeLeft?: BulkAction & { color: 'primary' | 'danger' };
};

function groupFor(n: Note, sort: SortOrder, colorNames: (string | null)[]) {
  switch (sort) {
    case 'created':
      return { key: monthKey(n.createdAt), title: monthLabel(n.createdAt) };
    case 'title': {
      const ch = (n.title.trim()[0] ?? '').toUpperCase();
      if (/[A-Z]/.test(ch)) return { key: ch, title: ch };
      if (/[؀-ۿ]/.test(ch)) return { key: 'ar', title: 'عربي' };
      return ch ? { key: '#', title: '#' } : { key: '-', title: 'Untitled' };
    }
    case 'color':
      return n.color === null ? { key: 'none', title: 'No colour' } : { key: `c${n.color}`, title: colorNames[n.color] ?? COLOR_NAMES[n.color] };
    case 'date':
      return n.dateAt ? { key: monthKey(n.dateAt), title: monthLabel(n.dateAt) } : { key: 'none', title: 'No date' };
    default:
      return { key: monthKey(n.editedAt), title: monthLabel(n.editedAt) };
  }
}

// The timetable: sections with a sticky guide bar, rows, multi-select
export function NoteList({ notes, header, actions, empty, footerSpace = 96, overlay, sort = 'edited', colorNames = NO_NAMES, swipeRight, swipeLeft }: Props) {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sync = useSyncState();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [snack, setSnack] = useState<SnackMessage>(null);
  const selecting = selected.size > 0;

  // Group rows under a sticky guide bar that matches the sort order
  const sections = useMemo(() => {
    const out: { key: string; title: string; data: Note[] }[] = [];
    for (const n of notes ?? []) {
      const g = n.pinned ? { key: 'pinned', title: 'Pinned' } : groupFor(n, sort, colorNames);
      let s = out[out.length - 1];
      if (!s || s.key !== g.key) {
        s = { ...g, data: [] };
        out.push(s);
      }
      s.data.push(n);
    }
    return out;
  }, [notes, sort, colorNames]);

  const toggle = useCallback((n: Note) => {
    Haptics.selectionAsync();
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(n.id) ? next.delete(n.id) : next.add(n.id);
      return next;
    });
  }, []);

  const open = useCallback(
    (n: Note) => {
      if (selected.size) return toggle(n);
      if (!n.seen) markSeen(n.id);
      router.push({ pathname: '/note/[id]', params: { id: n.id } });
    },
    [router, selected.size, toggle],
  );

  // Turn a swipe action into what SwipeRow needs, for one note
  const side = (a: Props['swipeRight'], n: Note): SwipeSide | undefined =>
    a && {
      icon: a.icon,
      label: a.label,
      color: a.color === 'danger' ? c.danger : c.primary,
      run: async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        const msg = await a.run([n.id]);
        if (msg) setSnack(msg);
      },
    };

  const runAction = async (a: BulkAction) => {
    const ids = [...selected];
    setSelected(new Set());
    const msg = await a.run(ids);
    if (msg) setSnack(msg);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.ground }}>
      <SectionList
        sections={sections}
        keyExtractor={(n) => n.id}
        stickySectionHeadersEnabled
        ListHeaderComponent={<>{header}</>}
        renderSectionHeader={({ section }) => (
          <View style={[styles.guide, { backgroundColor: c.groundAlt, borderBottomColor: c.rule }]}>
            <Text style={[type.labelSmall, styles.guideText, { color: c.inkMuted }]}>{section.title}</Text>
            <Text style={[type.labelSmall, styles.guideText, { color: c.inkMuted, fontVariant: ['tabular-nums'] }]}>
              {section.data.length} {section.data.length === 1 ? 'note' : 'notes'}
            </Text>
          </View>
        )}
        renderItem={({ item, index, section }) => {
          // Same day as the row above (in this section)? Then the date isn't repeated
          const prev = index > 0 ? section.data[index - 1] : null;
          const repeat = !!prev && !prev.pinned === !item.pinned && sameDay(prev.editedAt, item.editedAt);
          return (
            <SwipeRow enabled={!selecting} right={side(swipeRight, item)} left={side(swipeLeft, item)}>
              <NoteRow note={item} repeat={repeat} selected={selected.has(item.id)} onPress={open} onLongPress={toggle} />
            </SwipeRow>
          );
        }}
        ListEmptyComponent={
          notes ? (
            <View style={styles.empty}>
              <Icon name={empty.icon} size={40} color={c.ruleStrong} />
              <Text style={[type.titleMedium, { color: c.ink }]}>{empty.title}</Text>
              <Text style={[type.bodySmall, { color: c.inkMuted, textAlign: 'center' }]}>{empty.body}</Text>
            </View>
          ) : undefined
        }
        ListFooterComponent={<View style={{ height: footerSpace }} />}
        refreshControl={
          <RefreshControl
            refreshing={sync.kind === 'syncing'}
            onRefresh={syncInBackground}
            colors={[c.primary]}
            progressBackgroundColor={c.ground}
          />
        }
        initialNumToRender={14}
        windowSize={11}
      />

      {!selecting && overlay}

      {selecting && (
        <View style={[styles.actionBar, { backgroundColor: c.shell, paddingTop: insets.top }]}>
          <Pressable onPress={() => setSelected(new Set())} hitSlop={8} style={styles.iconBtn} accessibilityLabel="Cancel selection">
            <Icon name="close" color={c.onShell} />
          </Pressable>
          <Text style={[type.title, { color: c.onShell, flex: 1, fontVariant: ['tabular-nums'] }]}>{selected.size}</Text>
          {actions.map((a) => (
            <Pressable key={a.label} onPress={() => runAction(a)} style={styles.iconBtn} accessibilityLabel={a.label} android_ripple={{ color: c.shellField, borderless: true }}>
              <Icon name={a.icon} color={c.onShell} />
            </Pressable>
          ))}
        </View>
      )}

      <Snackbar message={snack} onDone={() => setSnack(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  guide: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space(4), paddingVertical: space(2), borderBottomWidth: StyleSheet.hairlineWidth },
  guideText: { textTransform: 'uppercase', letterSpacing: 0.8 },
  empty: { alignItems: 'center', gap: space(2), paddingHorizontal: space(10), paddingVertical: space(16) },
  actionBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space(1), paddingBottom: space(2), minHeight: 64, gap: space(1), elevation: 4 },
  iconBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
