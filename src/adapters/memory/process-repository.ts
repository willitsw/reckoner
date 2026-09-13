import { liveIncludeError } from '@/src/domain/include';
import { rankBetween } from '@/src/domain/rank';
import { stepIdFromPath } from '@/src/domain/run';
import type { Process, ProcessId, Run, RunCheck, Step, StepKind, UserId } from '@/src/domain/types';
import { normalizeUrl } from '@/src/domain/url';
import type {
  CreateProcessInput,
  CreateStepInput,
  ProcessRepository,
} from '@/src/ports/process-repository';
import type { RunRepository } from '@/src/ports/run-repository';

function nowIso() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Code-point order. Fractional ranks are not locale strings. */
function compareRank(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareLibrary(a: Process, b: Process) {
  if (a.pinnedAt && b.pinnedAt) {
    const byPin = b.pinnedAt.localeCompare(a.pinnedAt);
    if (byPin !== 0) return byPin;
  } else if (a.pinnedAt) {
    return -1;
  } else if (b.pinnedAt) {
    return 1;
  }

  const byUpdated = b.updatedAt.localeCompare(a.updatedAt);
  if (byUpdated !== 0) return byUpdated;
  return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
}

function liveIncludes(steps: Map<string, Step>) {
  return [...steps.values()]
    .filter((step) => step.deletedAt === null && step.childProcessId)
    .map((step) => ({
      processId: step.processId,
      childProcessId: step.childProcessId as string,
    }));
}

export type MemoryLibrary = {
  processes: ProcessRepository;
  runs: RunRepository;
};

/**
 * Ephemeral in-memory process and run store for scaffold / tests.
 * Delete is soft, matching the Postgres model. Runs and processes share one store
 * so deleting a process discards its in-progress run.
 */
export function createMemoryLibrary(): MemoryLibrary {
  const processes = new Map<ProcessId, Process>();
  const steps = new Map<string, Step>();
  const runs = new Map<string, Run>();
  const checks = new Map<string, RunCheck>();

  function requireProcess(processId: ProcessId) {
    const existing = processes.get(processId);
    if (!existing) throw new Error(`Process not found: ${processId}`);
    return existing;
  }

  function touch(process: Process, patch: Partial<Process>): Process {
    const updated: Process = {
      ...process,
      ...patch,
      updatedBy: process.ownerId,
      updatedAt: nowIso(),
    };
    processes.set(process.id, updated);
    return updated;
  }

  function guardInclude(processId: ProcessId, childProcessId: ProcessId | null) {
    if (!childProcessId) return;
    const parent = requireProcess(processId);
    const child = processes.get(childProcessId) ?? null;
    const error = liveIncludeError({
      parentId: processId,
      childId: childProcessId,
      parentOwnerId: parent.ownerId,
      child: child ? { ownerId: child.ownerId, deletedAt: child.deletedAt } : null,
      edges: liveIncludes(steps),
    });
    if (error) throw new Error(error);
  }

  function applyStep(existing: Step, patch: Partial<Step>): Step {
    const kind: StepKind = patch.kind ?? existing.kind;
    const leavingAction = kind !== 'action';
    const childProcessId = leavingAction
      ? null
      : patch.childProcessId !== undefined
        ? patch.childProcessId
        : existing.childProcessId;
    const optional = leavingAction ? false : (patch.optional ?? existing.optional);

    if (optional && kind !== 'action') {
      throw new Error('Only an action can be optional.');
    }
    if (childProcessId && kind !== 'action') {
      throw new Error('Only an action can include a process.');
    }
    if (childProcessId && childProcessId !== existing.childProcessId) {
      guardInclude(existing.processId, childProcessId);
    }

    return {
      ...existing,
      ...patch,
      kind,
      optional,
      childProcessId,
      url: patch.url !== undefined ? normalizeUrl(patch.url) : existing.url,
      updatedBy: existing.ownerId,
      updatedAt: nowIso(),
    };
  }

  function inProgressRun(processId: ProcessId) {
    return (
      [...runs.values()].find((run) => run.processId === processId && run.status === 'in_progress') ??
      null
    );
  }

  function discardInProgress(processId: ProcessId) {
    const current = inProgressRun(processId);
    if (!current) return;
    runs.set(current.id, {
      ...current,
      status: 'discarded',
      completedAt: null,
      updatedAt: nowIso(),
    });
  }

  const processRepository: ProcessRepository = {
    async listProcesses(ownerId: UserId) {
      return [...processes.values()]
        .filter((p) => p.ownerId === ownerId && p.deletedAt === null && p.archivedAt === null)
        .sort(compareLibrary);
    },

    async listArchivedProcesses(ownerId: UserId) {
      return [...processes.values()]
        .filter((p) => p.ownerId === ownerId && p.deletedAt === null && p.archivedAt !== null)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title));
    },

    async getProcess(processId) {
      return processes.get(processId) ?? null;
    },

    async listIncludeCandidates(parentId) {
      const parent = requireProcess(parentId);
      const edges = liveIncludes(steps);
      const candidates = [...processes.values()].filter((process) => {
        if (process.deletedAt || process.ownerId !== parent.ownerId) return false;
        return (
          liveIncludeError({
            parentId,
            childId: process.id,
            parentOwnerId: parent.ownerId,
            child: { ownerId: process.ownerId, deletedAt: process.deletedAt },
            edges,
          }) === null
        );
      });
      const live = candidates.filter((process) => process.archivedAt === null).sort(compareLibrary);
      const archived = candidates
        .filter((process) => process.archivedAt !== null)
        .sort(
          (a, b) =>
            b.updatedAt.localeCompare(a.updatedAt) ||
            a.title.localeCompare(b.title) ||
            a.id.localeCompare(b.id),
        );
      return [...live, ...archived];
    },

    async createProcess(input: CreateProcessInput) {
      const timestamp = nowIso();
      const process: Process = {
        id: id('proc'),
        ownerId: input.ownerId,
        createdBy: input.ownerId,
        updatedBy: input.ownerId,
        title: input.title,
        notes: input.notes ?? '',
        pinnedAt: null,
        archivedAt: null,
        deletedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      processes.set(process.id, process);
      return process;
    },

    async updateProcess(processId, patch) {
      return touch(requireProcess(processId), patch);
    },

    async pinProcess(processId) {
      const existing = requireProcess(processId);
      if (existing.deletedAt) throw new Error('A deleted process cannot be pinned.');
      if (existing.archivedAt) throw new Error('Unarchive this process before pinning it.');
      return touch(existing, { pinnedAt: nowIso() });
    },

    async unpinProcess(processId) {
      const existing = requireProcess(processId);
      if (existing.deletedAt) throw new Error('A deleted process cannot be pinned.');
      return touch(existing, { pinnedAt: null });
    },

    async archiveProcess(processId) {
      const existing = requireProcess(processId);
      if (existing.deletedAt) throw new Error('A deleted process cannot be archived.');
      if (existing.archivedAt) return existing;
      return touch(existing, { archivedAt: nowIso(), pinnedAt: null });
    },

    async unarchiveProcess(processId) {
      const existing = requireProcess(processId);
      if (existing.deletedAt) throw new Error('A deleted process cannot be restored from the archive.');
      return touch(existing, { archivedAt: null });
    },

    async deleteProcess(processId) {
      const existing = processes.get(processId);
      if (!existing || existing.deletedAt) return;
      discardInProgress(processId);
      touch(existing, { deletedAt: nowIso() });
    },

    async listSteps(processId) {
      return [...steps.values()]
        .filter((s) => s.processId === processId && s.deletedAt === null)
        .sort((a, b) => compareRank(a.position, b.position) || compareRank(a.id, b.id));
    },

    async createStep(input: CreateStepInput) {
      const process = requireProcess(input.processId);
      if (process.deletedAt) throw new Error('A deleted process cannot take new steps.');

      const kind: StepKind = input.kind ?? 'action';
      if (kind !== 'action' && (input.optional || input.childProcessId)) {
        throw new Error('Only an action can be optional or include a process.');
      }
      const childProcessId = input.childProcessId ?? null;
      const optional = input.optional ?? false;
      guardInclude(input.processId, childProcessId);

      const timestamp = nowIso();
      const siblings = [...steps.values()].filter(
        (s) => s.processId === input.processId && s.deletedAt === null,
      );
      const last = siblings.map((s) => s.position).sort(compareRank).at(-1) ?? null;
      const position = input.position ?? rankBetween(last, null);
      const step: Step = {
        id: id('step'),
        processId: input.processId,
        ownerId: process.ownerId,
        createdBy: process.ownerId,
        updatedBy: process.ownerId,
        position,
        kind,
        optional,
        body: input.body,
        notes: input.notes ?? '',
        url: normalizeUrl(input.url),
        childProcessId,
        deletedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      steps.set(step.id, step);
      return step;
    },

    async updateStep(stepId, patch) {
      const existing = steps.get(stepId);
      if (!existing) throw new Error(`Step not found: ${stepId}`);
      const updated = applyStep(existing, patch);
      steps.set(stepId, updated);
      return updated;
    },

    async deleteStep(stepId) {
      const existing = steps.get(stepId);
      if (!existing || existing.deletedAt) return;
      const updated = applyStep(existing, { deletedAt: nowIso() });
      steps.set(stepId, updated);
    },

    async clearLocal() {
      processes.clear();
      steps.clear();
      runs.clear();
      checks.clear();
    },
  };

  const runRepository: RunRepository = {
    async getInProgressRun(processId) {
      return inProgressRun(processId);
    },

    async openRun(processId) {
      const existing = inProgressRun(processId);
      if (existing) return existing;
      const process = requireProcess(processId);
      if (process.deletedAt) throw new Error('A deleted process cannot be run.');
      const timestamp = nowIso();
      const run: Run = {
        id: id('run'),
        processId,
        ownerId: process.ownerId,
        createdBy: process.ownerId,
        updatedBy: process.ownerId,
        status: 'in_progress',
        startedAt: timestamp,
        completedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      runs.set(run.id, run);
      return run;
    },

    async listChecks(runId) {
      return [...checks.values()]
        .filter((check) => check.runId === runId)
        .sort((a, b) => a.occurrencePath.localeCompare(b.occurrencePath));
    },

    async check(runId, stepId, occurrencePath) {
      const run = runs.get(runId);
      if (!run || run.status !== 'in_progress') {
        throw new Error('That run is no longer in progress.');
      }
      const step = steps.get(stepId);
      if (!step || step.deletedAt) throw new Error('That step is not available.');
      if (step.kind !== 'action') throw new Error('Only an action can be checked.');
      if (step.ownerId !== run.ownerId) throw new Error('You can only check a step you own.');
      if (stepIdFromPath(occurrencePath) !== stepId) {
        throw new Error('That check does not match the step.');
      }

      const existing = [...checks.values()].find(
        (check) => check.runId === runId && check.occurrencePath === occurrencePath,
      );
      if (existing) return existing;

      const timestamp = nowIso();
      const check: RunCheck = {
        id: id('check'),
        runId,
        stepId,
        ownerId: run.ownerId,
        occurrencePath,
        checkedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      checks.set(check.id, check);
      return check;
    },

    async uncheck(runId, occurrencePath) {
      const run = runs.get(runId);
      if (!run || run.status !== 'in_progress') {
        throw new Error('That run is no longer in progress.');
      }
      for (const [checkId, check] of checks) {
        if (check.runId === runId && check.occurrencePath === occurrencePath) {
          checks.delete(checkId);
        }
      }
    },

    async startAgain(processId) {
      discardInProgress(processId);
      return runRepository.openRun(processId);
    },
  };

  return { processes: processRepository, runs: runRepository };
}

export function createMemoryProcessRepository(): ProcessRepository {
  return createMemoryLibrary().processes;
}
