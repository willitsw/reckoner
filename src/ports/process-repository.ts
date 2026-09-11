import type { Process, ProcessId, Step, UserId } from '@/src/domain/types';

export type CreateProcessInput = {
  ownerId: UserId;
  title: string;
  notes?: string;
};

export type CreateStepInput = {
  processId: ProcessId;
  body: string;
  notes?: string;
  childProcessId?: ProcessId | null;
  position?: number;
};

/**
 * Process library persistence. v1: owner-scoped; offline via sync adapter later.
 */
export interface ProcessRepository {
  listProcesses(ownerId: UserId): Promise<Process[]>;
  getProcess(id: ProcessId): Promise<Process | null>;
  createProcess(input: CreateProcessInput): Promise<Process>;
  updateProcess(
    id: ProcessId,
    patch: Partial<Pick<Process, 'title' | 'notes'>>,
  ): Promise<Process>;
  deleteProcess(id: ProcessId): Promise<void>;

  listSteps(processId: ProcessId): Promise<Step[]>;
  createStep(input: CreateStepInput): Promise<Step>;
  updateStep(
    id: string,
    patch: Partial<Pick<Step, 'body' | 'notes' | 'position' | 'childProcessId'>>,
  ): Promise<Step>;
  deleteStep(id: string): Promise<void>;
}
