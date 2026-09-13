import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { getContainer } from '@/src/di/container';
import { processTitle } from '@/src/domain/process-title';
import type { Process, ProcessId } from '@/src/domain/types';

export function IncludePicker({
  parentId,
  onSelect,
  onCreate,
  onClose,
}: {
  parentId: ProcessId;
  onSelect: (processId: ProcessId) => Promise<void>;
  onCreate: () => Promise<void>;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [candidates, setCandidates] = useState<Process[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await getContainer().processes.listIncludeCandidates(parentId);
      setCandidates(list);
      setReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setReady(true);
    }
  }, [parentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = candidates.filter((process) =>
    processTitle(process.title).toLowerCase().includes(query.trim().toLowerCase()),
  );

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={onClose}>
      <View
        style={[
          styles.screen,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 12,
          },
        ]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Include a process</Text>
          <Pressable onPress={onClose} disabled={busy}>
            <Text style={{ color: colors.tint, fontWeight: '600' }}>Cancel</Text>
          </Pressable>
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search"
          placeholderTextColor={colors.textSecondary}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          style={[
            styles.search,
            { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
          ]}
        />

        <Pressable
          disabled={busy}
          onPress={() => void run(onCreate)}
          style={({ pressed }) => [
            styles.row,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed || busy ? 0.7 : 1,
            },
          ]}>
          <Text style={[styles.rowTitle, { color: colors.tint }]}>New process</Text>
        </Pressable>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={filtered.length === 0 ? styles.emptyList : styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            ready ? (
              <Text style={[styles.empty, { color: colors.textSecondary }]}>
                {query.trim() ? 'No matches' : 'Nothing else to include yet'}
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              disabled={busy}
              onPress={() => void run(() => onSelect(item.id))}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: pressed || busy ? 0.7 : 1,
                },
              ]}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>{processTitle(item.title)}</Text>
              {item.archivedAt ? (
                <Text style={[styles.meta, { color: colors.textSecondary }]}>Archived</Text>
              ) : null}
            </Pressable>
          )}
        />

        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: '700' },
  search: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  list: { gap: 8, paddingBottom: 24 },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  empty: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  row: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16 },
  rowTitle: { fontSize: 17, fontWeight: '600' },
  meta: { fontSize: 13, marginTop: 4 },
  error: { fontSize: 14, lineHeight: 20 },
});
