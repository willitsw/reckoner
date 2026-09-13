import { INCLUDE_DEPTH_LIMIT } from '@/src/domain/include';
import type { Process, ProcessId, Step } from '@/src/domain/types';

export function occurrencePath(stepIds: readonly string[]): string {
  if (stepIds.length === 0 || stepIds.some((id) => id.length === 0 || id.includes('/'))) {
    throw new Error('A check needs a step.');
  }
  return stepIds.map((id) => `/${id}`).join('');
}

/** Last segment, which must be the checked step’s id. */
export function stepIdFromPath(path: string): string | null {
  const parts = path.split('/').filter((part) => part.length > 0);
  return parts.at(-1) ?? null;
}

export type RunInclude = {
  process: Process | null;
  unavailable: boolean;
  /** Hit the include depth stop. Do not treat missing descendants as done. */
  truncated: boolean;
  nodes: RunNode[];
};

export type RunNode = {
  step: Step;
  path: string;
  include: RunInclude | null;
};

function byPosition(a: Step, b: Step) {
  if (a.position < b.position) return -1;
  if (a.position > b.position) return 1;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

function expandProcess(
  processId: ProcessId,
  prefix: readonly string[],
  ancestors: readonly ProcessId[],
  processes: ReadonlyMap<ProcessId, Process>,
  stepsByProcess: ReadonlyMap<ProcessId, readonly Step[]>,
): RunNode[] {
  const steps = [...(stepsByProcess.get(processId) ?? [])]
    .filter((step) => step.deletedAt === null)
    .sort(byPosition);

  return steps.map((step) => {
    const pathIds = [...prefix, step.id];
    return {
      step,
      path: occurrencePath(pathIds),
      include: step.childProcessId
        ? expandInclude(step.childProcessId, pathIds, [...ancestors, processId], processes, stepsByProcess)
        : null,
    };
  });
}

function expandInclude(
  childId: ProcessId,
  prefix: readonly string[],
  ancestors: readonly ProcessId[],
  processes: ReadonlyMap<ProcessId, Process>,
  stepsByProcess: ReadonlyMap<ProcessId, readonly Step[]>,
): RunInclude {
  const child = processes.get(childId) ?? null;
  if (!child || child.deletedAt) {
    return { process: child, unavailable: true, truncated: false, nodes: [] };
  }
  if (ancestors.includes(childId)) {
    return { process: child, unavailable: true, truncated: false, nodes: [] };
  }
  if (ancestors.length >= INCLUDE_DEPTH_LIMIT) {
    return { process: child, unavailable: false, truncated: true, nodes: [] };
  }
  return {
    process: child,
    unavailable: false,
    truncated: false,
    nodes: expandProcess(childId, prefix, ancestors, processes, stepsByProcess),
  };
}

/** Live expansion of a process for a run. Soft-deleted steps are omitted. */
export function expandRun(input: {
  processId: ProcessId;
  processes: ReadonlyMap<ProcessId, Process>;
  stepsByProcess: ReadonlyMap<ProcessId, readonly Step[]>;
}): RunNode[] {
  return expandProcess(input.processId, [], [], input.processes, input.stepsByProcess);
}

/** Derived completion. Optional actions never block. Headings and notes are ignored. */
export function isSatisfied(node: RunNode, checked: ReadonlySet<string>): boolean {
  if (node.step.kind !== 'action' || node.step.optional) return true;
  if (checked.has(node.path)) return true;
  if (!node.include) return false;
  if (node.include.unavailable || node.include.truncated) return false;
  return node.include.nodes.every((child) => isSatisfied(child, checked));
}

export function isRunComplete(nodes: readonly RunNode[], checked: ReadonlySet<string>): boolean {
  return nodes.every((node) => isSatisfied(node, checked));
}

export function requiredProgress(nodes: readonly RunNode[], checked: ReadonlySet<string>): {
  done: number;
  total: number;
} {
  const required = nodes.filter((node) => node.step.kind === 'action' && !node.step.optional);
  return {
    done: required.filter((node) => isSatisfied(node, checked)).length,
    total: required.length,
  };
}
