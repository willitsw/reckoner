import { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { processTitle } from '@/src/domain/process-title';
import {
  expandRun,
  isRunComplete,
  isSatisfied,
  requiredProgress,
  type RunNode,
} from '@/src/domain/run';
import type { Process, Run, Step } from '@/src/domain/types';
import { getContainer } from '@/src/di/container';

export default function RunScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [process, setProcess] = useState<Process | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [nodes, setNodes] = useState<RunNode[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const repo = getContainer().processes;
    const loaded = await repo.getProcess(id);
    setProcess(loaded);
    if (!loaded || loaded.deletedAt) {
      setRun(null);
      setNodes([]);
      setChecked(new Set());
      setReady(true);
      return;
    }

    const processes = new Map<string, Process>();
    const stepsByProcess = new Map<string, Step[]>();
    const queue = [loaded.id];
    const seen = new Set<string>();
    while (queue.length > 0) {
      const processId = queue.shift();
      if (!processId || seen.has(processId)) continue;
      seen.add(processId);
      const current = processId === loaded.id ? loaded : await repo.getProcess(processId);
      if (current) processes.set(processId, current);
      if (!current || current.deletedAt) continue;
      const steps = await repo.listSteps(processId);
      stepsByProcess.set(processId, steps);
      for (const step of steps) {
        if (step.childProcessId) queue.push(step.childProcessId);
      }
    }

    const opened = await getContainer().runs.openRun(loaded.id);
    const checks = await getContainer().runs.listChecks(opened.id);
    setRun(opened);
    setNodes(expandRun({ processId: loaded.id, processes, stepsByProcess }));
    setChecked(new Set(checks.map((check) => check.occurrencePath)));
    setReady(true);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function runAction(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
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

  const progress = requiredProgress(nodes, checked);
  const complete = isRunComplete(nodes, checked);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: processTitle(process.title) }} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {process.notes.trim() ? (
          <Text style={[styles.notes, { color: colors.textSecondary }]}>{process.notes}</Text>
        ) : null}
        {progress.total > 0 ? (
          <Text style={[styles.progress, { color: complete ? colors.tint : colors.textSecondary }]}>
            {progress.done} of {progress.total}
          </Text>
        ) : null}

        {nodes.length === 0 ? (
          <Text style={{ color: colors.textSecondary }}>No steps to check yet.</Text>
        ) : (
          <RunNodes
            nodes={nodes}
            depth={0}
            checked={checked}
            onToggle={(node) =>
              void runAction(async () => {
                if (!run) return;
                const explicit = checked.has(node.path);
                if (explicit) {
                  await getContainer().runs.uncheck(run.id, node.path);
                  setChecked((current) => {
                    const next = new Set(current);
                    next.delete(node.path);
                    return next;
                  });
                  return;
                }
                if (!node.step.optional && isSatisfied(node, checked)) return;
                await getContainer().runs.check(run.id, node.step.id, node.path);
                setChecked((current) => new Set(current).add(node.path));
              })
            }
          />
        )}

        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

        {checked.size > 0 ? (
          <View style={styles.reset}>
            {confirmingReset ? (
              <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>
                Start again? Checks on this run will be cleared.
              </Text>
            ) : null}
            <View style={styles.toolbar}>
              {confirmingReset ? (
                <Pressable
                  onPress={() => setConfirmingReset(false)}
                  style={({ pressed }) => [
                    styles.tool,
                    { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                  ]}>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>Cancel</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => {
                  if (!confirmingReset) {
                    setConfirmingReset(true);
                    return;
                  }
                  void runAction(async () => {
                    if (!process) return;
                    const next = await getContainer().runs.startAgain(process.id);
                    setRun(next);
                    setChecked(new Set());
                    setConfirmingReset(false);
                  });
                }}
                style={({ pressed }) => [
                  styles.tool,
                  { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                ]}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>Start again</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function RunNodes({
  nodes,
  depth,
  checked,
  onToggle,
}: {
  nodes: RunNode[];
  depth: number;
  checked: Set<string>;
  onToggle: (node: RunNode) => void;
}) {
  return (
    <View style={{ gap: 8, marginLeft: depth === 0 ? 0 : 16 }}>
      {nodes.map((node) => (
        <RunRow key={node.path} node={node} depth={depth} checked={checked} onToggle={onToggle} />
      ))}
    </View>
  );
}

function RunRow({
  node,
  depth,
  checked,
  onToggle,
}: {
  node: RunNode;
  depth: number;
  checked: Set<string>;
  onToggle: (node: RunNode) => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const action = node.step.kind === 'action';
  const explicit = checked.has(node.path);
  const boxOn = action && (node.step.optional ? explicit : isSatisfied(node, checked));

  return (
    <View style={styles.node}>
      {node.step.kind === 'heading' ? (
        <Text style={[styles.heading, { color: colors.text }]}>{node.step.body || 'Heading'}</Text>
      ) : node.step.kind === 'note' ? (
        <Text style={[styles.note, { color: colors.textSecondary }]}>{node.step.body}</Text>
      ) : (
        <View style={styles.node}>
          <Pressable
            onPress={() => onToggle(node)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: boxOn }}
            style={styles.action}>
            <View
              style={[
                styles.box,
                {
                  borderColor: boxOn ? colors.tint : colors.border,
                  backgroundColor: boxOn ? colors.tint : 'transparent',
                },
              ]}>
              {boxOn ? <Text style={styles.mark}>✓</Text> : null}
            </View>
            <Text style={{ color: colors.text, fontSize: 16, lineHeight: 22, flex: 1 }}>
              {nodeLabel(node)}
            </Text>
          </Pressable>
          {node.step.optional ||
          (node.include && !node.include.unavailable && node.step.body.trim()) ||
          node.include?.unavailable ||
          node.include?.truncated ||
          node.step.notes.trim() ||
          node.step.url ? (
            <View style={styles.detail}>
              {node.step.optional ? (
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Optional</Text>
              ) : null}
              {node.include && !node.include.unavailable && node.step.body.trim() ? (
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                  Includes {processTitle(node.include.process?.title ?? '')}
                </Text>
              ) : null}
              {node.include?.unavailable ? (
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Not available</Text>
              ) : null}
              {node.include?.truncated ? (
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                  Too deeply nested to show.
                </Text>
              ) : null}
              {node.step.notes.trim() ? (
                <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20 }}>
                  {node.step.notes}
                </Text>
              ) : null}
              {node.step.url ? (
                <Pressable onPress={() => void Linking.openURL(node.step.url as string)}>
                  <Text style={{ color: colors.tint, fontSize: 14 }}>{node.step.url}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      )}
      {node.step.kind !== 'action' && node.step.notes.trim() ? (
        <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20 }}>{node.step.notes}</Text>
      ) : null}

      {node.include && !node.include.unavailable && !node.include.truncated ? (
        <RunNodes nodes={node.include.nodes} depth={depth + 1} checked={checked} onToggle={onToggle} />
      ) : null}
    </View>
  );
}

function nodeLabel(node: RunNode): string {
  const body = node.step.body.trim();
  if (body) return body;
  if (node.include?.process) return processTitle(node.include.process.title);
  return 'Included process';
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20 },
  scroll: { gap: 12, paddingBottom: 40 },
  notes: { fontSize: 15, lineHeight: 22 },
  progress: { fontSize: 14, fontWeight: '600' },
  node: { gap: 8 },
  heading: { fontSize: 18, fontWeight: '700' },
  note: { fontSize: 15, lineHeight: 22 },
  action: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  detail: { marginLeft: 34, gap: 4 },
  box: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderRadius: 6,
    marginTop: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: { color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 16 },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tool: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  reset: { gap: 8, marginTop: 12 },
  error: { fontSize: 14, lineHeight: 20 },
});
