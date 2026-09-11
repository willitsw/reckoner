import { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from 'expo-router';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { getContainer } from '@/src/di/container';
import type { Process, Step } from '@/src/domain/types';

export default function ProcessDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [process, setProcess] = useState<Process | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [title, setTitle] = useState('');
  const [newStep, setNewStep] = useState('');
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const repo = getContainer().processes;
    const p = await repo.getProcess(id);
    setProcess(p);
    setTitle(p?.title ?? '');
    setSteps(p ? await repo.listSteps(p.id) : []);
    setReady(true);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function saveTitle() {
    if (!process || !title.trim()) return;
    await getContainer().processes.updateProcess(process.id, { title: title.trim() });
    await load();
  }

  async function addStep() {
    if (!process || !newStep.trim()) return;
    await getContainer().processes.createStep({
      processId: process.id,
      body: newStep.trim(),
    });
    setNewStep('');
    await load();
  }

  if (!ready) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary }}>Loading…</Text>
      </View>
    );
  }

  if (!process) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary }}>Process not found.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <TextInput
        value={title}
        onChangeText={setTitle}
        onEndEditing={saveTitle}
        style={[styles.titleInput, { color: colors.text, borderBottomColor: colors.border }]}
      />
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        Steps below. Nested includes (live reference) and run mode come next.
      </Text>

      <FlatList
        data={steps}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 24 }}>
            No steps yet. Add the first one.
          </Text>
        }
        renderItem={({ item, index }) => (
          <View
            style={[
              styles.stepRow,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}>
            <Text style={[styles.stepIndex, { color: colors.textSecondary }]}>{index + 1}</Text>
            <Text style={[styles.stepBody, { color: colors.text }]}>{item.body}</Text>
          </View>
        )}
      />

      <View style={styles.addRow}>
        <TextInput
          value={newStep}
          onChangeText={setNewStep}
          placeholder="New step"
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.stepInput,
            { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
          ]}
          onSubmitEditing={addStep}
          returnKeyType="done"
        />
        <Pressable
          onPress={addStep}
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: colors.tint, opacity: pressed ? 0.8 : 1 },
          ]}>
          <Text style={styles.addLabel}>Add</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20 },
  titleInput: {
    fontSize: 24,
    fontWeight: '700',
    borderBottomWidth: 1,
    paddingVertical: 8,
    marginBottom: 8,
  },
  hint: { fontSize: 14, marginBottom: 16 },
  list: { gap: 8, paddingBottom: 16 },
  stepRow: {
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'flex-start',
  },
  stepIndex: { fontSize: 14, fontWeight: '600', width: 22 },
  stepBody: { flex: 1, fontSize: 16, lineHeight: 22 },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 'auto', paddingTop: 12 },
  stepInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  addButton: {
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  addLabel: { color: '#fff', fontWeight: '600' },
});
