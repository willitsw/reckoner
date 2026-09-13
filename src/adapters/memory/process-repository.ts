import type {
  CreateProcessInput,
  CreateStepInput,
  ProcessRepository,
} from '@/src/ports/process-repository';
import type { Process, ProcessId, Step, UserId } from '@/src/domain/types';

function nowIso() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Ephemeral in-memory process store for scaffold / tests.
 */
export function createMemoryProcessRepository(): ProcessRepository {
  const processes = new Map<ProcessId, Process>();
  const steps = new Map<string, Step>();

  return {
    async listProcesses(ownerId: UserId) {
      return [...processes.values()]
        .filter((p) => p.ownerId === ownerId && p.deletedAt === null && p.archivedAt === null)
        .sort((a, b) => {
          if (a.pinnedAt && !b.pinnedAt) return -1;
          if (!a.pinnedAt && b.pinnedAt) return 1;
          if (a.pinnedAt && b.pinnedAt) {
            const byPin = b.pinnedAt.localeCompare(a.pinnedAt);
            if (byPin !== 0) return byPin;
          }
          return b.updatedAt.localeCompare(a.updatedAt);
        });
    },

    async getProcess(processId) {
      return processes.get(processId) ?? null;
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
      const existing = processes.get(processId);
      if (!existing) throw new Error(`Process not found: ${processId}`);
      const updated: Process = {
        ...existing,
        ...patch,
        updatedAt: nowIso(),
      };
      processes.set(processId, updated);
      return updated;
    },

    async deleteProcess(processId) {
      processes.delete(processId);
      for (const [stepId, step] of steps) {
        if (step.processId === processId) steps.delete(stepId);
      }
    },

    async listSteps(processId) {
      return [...steps.values()]
        .filter((s) => s.processId === processId && s.deletedAt === null)
        .sort((a, b) => a.position.localeCompare(b.position) || a.id.localeCompare(b.id));
    },

    async createStep(input: CreateStepInput) {
      const timestamp = nowIso();
      const siblings = [...steps.values()].filter((s) => s.processId === input.processId);
      const last = siblings.map((s) => s.position).sort().at(-1);
      const position = input.position ?? (last ? `${last}0` : 'a0');
      const process = processes.get(input.processId);
      const step: Step = {
        id: id('step'),
        processId: input.processId,
        ownerId: process?.ownerId ?? '',
        createdBy: process?.ownerId ?? null,
        updatedBy: process?.ownerId ?? null,
        position,
        kind: 'action',
        optional: false,
        body: input.body,
        notes: input.notes ?? '',
        url: null,
        childProcessId: input.childProcessId ?? null,
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
      const updated: Step = { ...existing, ...patch };
      steps.set(stepId, updated);
      return updated;
    },

    async deleteStep(stepId) {
      steps.delete(stepId);
    },

    async clearLocal() {
      processes.clear();
      steps.clear();
    },
  };
}
