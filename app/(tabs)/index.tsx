import { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { seedDemoLibrary } from '@/src/dev/demo-library';
import { getContainer } from '@/src/di/container';
import { processTitle } from '@/src/domain/process-title';
import type { Process } from '@/src/domain/types';
import { useSession } from '@/src/modules/auth/session-context';

export default function LibraryScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { session } = useSession();
  const router = useRouter();
  const [processes, setProcesses] = useState<Process[]>([]);
  const [inProgressIds, setInProgressIds] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const repo = getContainer().processes;
    const list = showArchived
      ? await repo.listArchivedProcesses(session.user.id)
      : await repo.listProcesses(session.user.id);
    const running = await Promise.all(
      list.map(async (process) => [
        process.id,
        (await getContainer().runs.getInProgressRun(process.id)) !== null,
      ] as const),
    );
    setProcesses(list);
    setInProgressIds(new Set(running.filter(([, active]) => active).map(([processId]) => processId)));
  }, [session, showArchived]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const filtered = processes.filter((p) =>
    processTitle(p.title).toLowerCase().includes(query.trim().toLowerCase()),
  );

  async function onCreate() {
    if (!session || creating) return;
    setCreating(true);
    try {
      const created = await getContainer().processes.createProcess({
        ownerId: session.user.id,
        title: 'Untitled process',
      });
      await load();
      router.push(`/process/${created.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function onLoadDemoLibrary() {
    if (!session || seeding) return;
    setSeeding(true);
    try {
      await seedDemoLibrary(getContainer().processes, session.user.id);
      await load();
    } finally {
      setSeeding(false);
    }
  }

  return (
    <View testID="library-screen" style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.headerBlock}>
        <Text style={[styles.brand, { color: colors.text }]}>Reckoner</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Processes you reuse — pack-outs, setups, tune-ups.
        </Text>
      </View>

      <TextInput
        testID="library-search"
        value={query}
        onChangeText={setQuery}
        placeholder={showArchived ? 'Search archived' : 'Search processes'}
        placeholderTextColor={colors.textSecondary}
        style={[
          styles.search,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            color: colors.text,
          },
        ]}
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
      />

      <Pressable
        testID="library-archive-toggle"
        onPress={() => setShowArchived((current) => !current)}
        style={styles.archiveToggle}>
        <Text style={{ color: colors.tint, fontWeight: '600' }}>
          {showArchived ? 'Back to library' : 'Archived'}
        </Text>
      </Pressable>

      <FlatList
        testID="library-list"
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          filtered.length === 0 ? styles.emptyList : styles.listContent
        }
        ListEmptyComponent={
          <View testID="library-empty" style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {showArchived ? 'Nothing archived' : 'No processes yet'}
            </Text>
            <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
              {showArchived
                ? 'Archived processes stay out of the library. You can still include them later.'
                : 'Create a process for a hobby workflow you repeat. Nest other processes by live reference as you go.'}
            </Text>
            {__DEV__ && !showArchived ? (
              <Pressable
                testID="library-load-demo"
                onPress={() => void onLoadDemoLibrary()}
                disabled={seeding}
                style={({ pressed }) => [
                  styles.demoButton,
                  {
                    borderColor: colors.border,
                    opacity: pressed || seeding ? 0.7 : 1,
                  },
                ]}>
                <Text style={{ color: colors.tint, fontWeight: '600' }}>
                  {seeding ? 'Loading demo…' : 'Load demo library'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const title = processTitle(item.title);
          const inProgress = inProgressIds.has(item.id);
          const runLabel = inProgress ? 'Resume' : 'Run';
          return (
            <View
              testID={`process-row-${item.id}`}
              style={[
                styles.row,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}>
              <Pressable
                onPress={() => router.push(`/process/${item.id}`)}
                accessibilityRole="button"
                accessibilityLabel={title}
                style={({ pressed }) => [styles.rowMain, { opacity: pressed ? 0.7 : 1 }]}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
                {item.pinnedAt ? (
                  <Text style={[styles.pin, { color: colors.textSecondary }]}>Pinned</Text>
                ) : null}
              </Pressable>
              <Pressable
                testID={`process-run-${item.id}`}
                onPress={() => router.push(`/run/${item.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`${runLabel} ${title}`}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.run,
                  { backgroundColor: colors.tint, opacity: pressed ? 0.8 : 1 },
                ]}>
                <Text style={styles.runLabel}>{runLabel}</Text>
              </Pressable>
            </View>
          );
        }}
      />

      {showArchived ? null : (
        <Pressable
          testID="library-new-process"
          onPress={onCreate}
          disabled={creating}
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: colors.tint, opacity: pressed || creating ? 0.8 : 1 },
          ]}>
          <Text style={styles.fabLabel}>{creating ? 'Creating…' : 'New process'}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20, paddingTop: 12 },
  headerBlock: { marginBottom: 16, gap: 6 },
  brand: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, lineHeight: 21 },
  search: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  listContent: { paddingBottom: 100, gap: 8 },
  emptyList: { flexGrow: 1, justifyContent: 'center', paddingBottom: 100 },
  empty: { gap: 8, paddingHorizontal: 8, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  emptyBody: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  demoButton: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingLeft: 16,
    paddingRight: 12,
    paddingVertical: 12,
  },
  rowMain: { flex: 1, paddingVertical: 4 },
  rowTitle: { fontSize: 17, fontWeight: '600' },
  pin: { fontSize: 13, marginTop: 4 },
  run: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  runLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
  archiveToggle: { alignSelf: 'flex-start', marginBottom: 12 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  fabLabel: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
