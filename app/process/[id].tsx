import { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { processTitle } from '@/src/domain/process-title';
import type { Process, ProcessId, Step, StepKind } from '@/src/domain/types';
import { getContainer } from '@/src/di/container';
import { IncludePicker } from '@/src/modules/process/include-picker';
import { positionAfterMove } from '@/src/modules/process/order';

const KINDS: { kind: StepKind; label: string }[] = [
  { kind: 'action', label: 'Action' },
  { kind: 'heading', label: 'Heading' },
  { kind: 'note', label: 'Note' },
];

export default function ProcessDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [process, setProcess] = useState<Process | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [included, setIncluded] = useState<Record<string, Process | null>>({});
  const [pickingStepId, setPickingStepId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [newStep, setNewStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [ready, setReady] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const repo = getContainer().processes;
    const loaded = await repo.getProcess(id);
    setProcess(loaded);
    setTitle(loaded?.title ?? '');
    setNotes(loaded?.notes ?? '');
    const nextSteps = loaded && !loaded.deletedAt ? await repo.listSteps(loaded.id) : [];
    const childIds = [
      ...new Set(nextSteps.flatMap((step) => (step.childProcessId ? [step.childProcessId] : []))),
    ];
    const children = Object.fromEntries(
      await Promise.all(
        childIds.map(async (childId) => [childId, await repo.getProcess(childId)] as const),
      ),
    );
    setIncluded(children);
    setSteps(nextSteps);
    setHasRun(loaded ? (await getContainer().runs.getInProgressRun(loaded.id)) !== null : false);
    setReady(true);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  }

  if (!ready) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary }}>Loading…</Text>
      </View>
    );
  }

  if (!process || process.deletedAt) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary }}>This process is not available.</Text>
      </View>
    );
  }

  const archived = process.archivedAt !== null;

  return (
    <View testID="process-screen" style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: processTitle(title) }} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TextInput
          testID="process-title"
          value={title}
          onChangeText={setTitle}
          onEndEditing={() =>
            void run(() => getContainer().processes.updateProcess(process.id, { title: title.trim() }))
          }
          placeholder="Untitled"
          placeholderTextColor={colors.textSecondary}
          style={[styles.titleInput, { color: colors.text, borderBottomColor: colors.border }]}
        />
        <TextInput
          testID="process-notes"
          value={notes}
          onChangeText={setNotes}
          onEndEditing={() =>
            void run(() => getContainer().processes.updateProcess(process.id, { notes }))
          }
          placeholder="Notes for this process"
          placeholderTextColor={colors.textSecondary}
          multiline
          style={[
            styles.notesInput,
            { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        />

        <View style={styles.toolbar}>
          <Pressable
            testID="process-run"
            onPress={() => router.push(`/run/${process.id}`)}
            style={({ pressed }) => [
              styles.tool,
              { backgroundColor: colors.tint, borderColor: colors.tint, opacity: pressed ? 0.8 : 1 },
            ]}>
            <Text style={{ color: '#fff', fontWeight: '600' }}>{hasRun ? 'Resume' : 'Run'}</Text>
          </Pressable>
          {archived ? (
            <Pressable
              onPress={() => void run(() => getContainer().processes.unarchiveProcess(process.id))}
              style={({ pressed }) => [
                styles.tool,
                { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>Unarchive</Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                onPress={() =>
                  void run(() =>
                    process.pinnedAt
                      ? getContainer().processes.unpinProcess(process.id)
                      : getContainer().processes.pinProcess(process.id),
                  )
                }
                style={({ pressed }) => [
                  styles.tool,
                  { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                ]}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>
                  {process.pinnedAt ? 'Unpin' : 'Pin'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => void run(() => getContainer().processes.archiveProcess(process.id))}
                style={({ pressed }) => [
                  styles.tool,
                  { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                ]}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>Archive</Text>
              </Pressable>
            </>
          )}
        </View>

        {archived ? (
          <Text style={[styles.section, { color: colors.textSecondary }]}>
            Archived. It stays out of the library until you unarchive it.
          </Text>
        ) : null}
        <Text style={[styles.section, { color: colors.textSecondary }]}>
          Actions can be checked off. Headings and notes cannot. Optional actions do not block
          completion. An action can include another process.
        </Text>

        {steps.map((step, index) => (
          <StepCard
            key={step.id}
            step={step}
            index={index}
            total={steps.length}
            onChange={(patch) => void run(() => getContainer().processes.updateStep(step.id, patch))}
            onMove={(toIndex) =>
              void run(async () => {
                const position = positionAfterMove(steps, step.id, toIndex);
                await getContainer().processes.updateStep(step.id, { position });
              })
            }
            onDelete={() => void run(() => getContainer().processes.deleteStep(step.id))}
            included={step.childProcessId ? (included[step.childProcessId] ?? null) : undefined}
            onOpenInclude={(childId) => router.push(`/process/${childId}`)}
            onInclude={() => setPickingStepId(step.id)}
            onRemoveInclude={() =>
              void run(() =>
                getContainer().processes.updateStep(step.id, { childProcessId: null }),
              )
            }
          />
        ))}

        <View style={styles.addRow}>
          <TextInput
            testID="process-new-step"
            value={newStep}
            onChangeText={setNewStep}
            placeholder="New step"
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.stepInput,
              { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
            ]}
            onSubmitEditing={() => {
              const body = newStep.trim();
              if (!body) return;
              setNewStep('');
              void run(() => getContainer().processes.createStep({ processId: process.id, body }));
            }}
            returnKeyType="done"
          />
          <Pressable
            testID="process-add-step"
            onPress={() => {
              const body = newStep.trim();
              if (!body) return;
              setNewStep('');
              void run(() => getContainer().processes.createStep({ processId: process.id, body }));
            }}
            style={({ pressed }) => [
              styles.addButton,
              { backgroundColor: colors.tint, opacity: pressed ? 0.8 : 1 },
            ]}>
            <Text style={styles.addLabel}>Add</Text>
          </Pressable>
        </View>

        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

        <View style={styles.deleteBlock}>
          {confirmingDelete ? (
            <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>
              Delete “{processTitle(process.title)}”? It leaves your library. This cannot be undone
              from the app yet.
            </Text>
          ) : null}
          <View style={styles.toolbar}>
            {confirmingDelete ? (
              <Pressable
                onPress={() => setConfirmingDelete(false)}
                style={({ pressed }) => [
                  styles.tool,
                  { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                ]}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => {
                if (!confirmingDelete) {
                  setConfirmingDelete(true);
                  return;
                }
                void run(async () => {
                  await getContainer().processes.deleteProcess(process.id);
                  router.back();
                });
              }}
              style={({ pressed }) => [
                styles.tool,
                { borderColor: colors.danger, opacity: pressed ? 0.7 : 1 },
              ]}>
              <Text style={{ color: colors.danger, fontWeight: '600' }}>
                {confirmingDelete ? 'Delete process' : 'Delete'}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
      {pickingStepId ? (
        <IncludePicker
          parentId={process.id}
          onClose={() => setPickingStepId(null)}
          onSelect={async (childId) => {
            await getContainer().processes.updateStep(pickingStepId, { childProcessId: childId });
            setPickingStepId(null);
            await load();
          }}
          onCreate={async () => {
            const created = await getContainer().processes.createProcess({
              ownerId: process.ownerId,
              title: '',
            });
            try {
              await getContainer().processes.updateStep(pickingStepId, {
                childProcessId: created.id,
              });
            } catch (error) {
              await getContainer().processes.deleteProcess(created.id);
              throw error;
            }
            setPickingStepId(null);
            router.push(`/process/${created.id}`);
          }}
        />
      ) : null}
    </View>
  );
}

function StepCard({
  step,
  index,
  total,
  included,
  onChange,
  onMove,
  onDelete,
  onOpenInclude,
  onInclude,
  onRemoveInclude,
}: {
  step: Step;
  index: number;
  total: number;
  /** Undefined when this step does not include. Null when the child cannot be loaded. */
  included?: Process | null;
  onChange: (patch: Partial<Pick<Step, 'body' | 'notes' | 'kind' | 'optional' | 'url'>>) => void;
  onMove: (toIndex: number) => void;
  onDelete: () => void;
  onOpenInclude: (childId: ProcessId) => void;
  onInclude: () => void;
  onRemoveInclude: () => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [body, setBody] = useState(step.body);
  const [notes, setNotes] = useState(step.notes);
  const [url, setUrl] = useState(step.url ?? '');

  return (
    <View
      testID={`step-card-${step.id}`}
      style={[styles.stepCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.kindRow}>
        {KINDS.map((option) => {
          const selected = step.kind === option.kind;
          return (
            <Pressable
              key={option.kind}
              onPress={() => onChange({ kind: option.kind })}
              style={[
                styles.kind,
                {
                  borderColor: selected ? colors.tint : colors.border,
                  backgroundColor: selected ? colors.background : 'transparent',
                },
              ]}>
              <Text style={{ color: selected ? colors.tint : colors.textSecondary, fontWeight: '600' }}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        testID={`step-body-${step.id}`}
        value={body}
        onChangeText={setBody}
        onEndEditing={() => onChange({ body })}
        placeholder={step.kind === 'heading' ? 'Heading' : step.kind === 'note' ? 'Note' : 'Step'}
        placeholderTextColor={colors.textSecondary}
        style={[styles.bodyInput, { color: colors.text, borderBottomColor: colors.border }]}
      />
      <TextInput
        value={notes}
        onChangeText={setNotes}
        onEndEditing={() => onChange({ notes })}
        placeholder="Notes"
        placeholderTextColor={colors.textSecondary}
        style={[styles.field, { color: colors.text, borderColor: colors.border }]}
      />
      <TextInput
        value={url}
        onChangeText={setUrl}
        onEndEditing={() => onChange({ url })}
        placeholder="Link (https://)"
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        style={[styles.field, { color: colors.text, borderColor: colors.border }]}
      />

      {step.kind === 'action' ? (
        <IncludeRow
          included={step.childProcessId ? included : undefined}
          onOpen={
            step.childProcessId && included && !included.deletedAt
              ? () => onOpenInclude(step.childProcessId as ProcessId)
              : undefined
          }
          onInclude={onInclude}
          onRemove={onRemoveInclude}
        />
      ) : null}

      <View style={styles.stepActions}>
        {step.kind === 'action' ? (
          <Pressable onPress={() => onChange({ optional: !step.optional })}>
            <Text style={{ color: colors.tint, fontWeight: '600' }}>
              {step.optional ? 'Optional' : 'Required'}
            </Text>
          </Pressable>
        ) : (
          <View />
        )}
        <View style={styles.stepActions}>
          <Pressable disabled={index === 0} onPress={() => onMove(index - 1)}>
            <Text style={{ color: index === 0 ? colors.border : colors.textSecondary, fontWeight: '600' }}>
              Up
            </Text>
          </Pressable>
          <Pressable disabled={index === total - 1} onPress={() => onMove(index + 1)}>
            <Text
              style={{
                color: index === total - 1 ? colors.border : colors.textSecondary,
                fontWeight: '600',
              }}>
              Down
            </Text>
          </Pressable>
          <Pressable onPress={onDelete}>
            <Text style={{ color: colors.danger, fontWeight: '600' }}>Remove</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function IncludeRow({
  included,
  onOpen,
  onInclude,
  onRemove,
}: {
  included?: Process | null;
  onOpen?: () => void;
  onInclude: () => void;
  onRemove: () => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  if (included === undefined) {
    return (
      <Pressable onPress={onInclude}>
        <Text style={{ color: colors.tint, fontWeight: '600' }}>Include a process</Text>
      </Pressable>
    );
  }

  const unavailable = !included || included.deletedAt !== null;

  return (
    <View style={styles.includeBlock}>
      {unavailable ? (
        <Text style={{ color: colors.textSecondary }}>This process is not available.</Text>
      ) : (
        <Pressable onPress={onOpen} disabled={!onOpen}>
          <Text style={{ color: colors.tint, fontWeight: '600' }}>
            Includes {processTitle(included.title)}
          </Text>
          {included.archivedAt ? (
            <Text style={{ color: colors.textSecondary, marginTop: 2 }}>Archived</Text>
          ) : null}
        </Pressable>
      )}
      <View style={styles.stepActions}>
        {unavailable ? null : (
          <Pressable onPress={onInclude}>
            <Text style={{ color: colors.tint, fontWeight: '600' }}>Change</Text>
          </Pressable>
        )}
        <Pressable onPress={onRemove}>
          <Text style={{ color: colors.danger, fontWeight: '600' }}>Remove</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { padding: 20, gap: 12, paddingBottom: 40 },
  titleInput: {
    fontSize: 24,
    fontWeight: '700',
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tool: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  section: { fontSize: 14, lineHeight: 20 },
  stepCard: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  kindRow: { flexDirection: 'row', gap: 8 },
  kind: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  bodyInput: { fontSize: 16, borderBottomWidth: 1, paddingVertical: 6 },
  field: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15 },
  includeBlock: { gap: 6 },
  stepActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  addRow: { flexDirection: 'row', gap: 8 },
  stepInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  addButton: { borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  addLabel: { color: '#fff', fontWeight: '600' },
  error: { fontSize: 14, lineHeight: 20 },
  deleteBlock: { gap: 8, marginTop: 12 },
});
