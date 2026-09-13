import type { Process, ProcessId, Step, StepKind, UserId } from '@/src/domain/types';

export type CreateProcessInput = {
  ownerId: UserId;
  title: string;
  notes?: string;
};

export type CreateStepInput = {
  processId: ProcessId;
  body: string;
  notes?: string;
  kind?: StepKind;
  optional?: boolean;
  url?: string | null;
  childProcessId?: ProcessId | null;
  position?: string;
};

/**
 * Process library persistence. v1: owner-scoped; offline via sync adapter later.
 */
export interface ProcessRepository {
  /** Live library: not deleted, not archived. Pinned first. */
  listProcesses(ownerId: UserId): Promise<Process[]>;
  listArchivedProcesses(ownerId: UserId): Promise<Process[]>;
  /** Includes soft-deleted rows so an include can render as unavailable. */
  getProcess(id: ProcessId): Promise<Process | null>;
  /**
   * Processes this parent may include: this owner's live and archived rows.
   * Omits self, deleted, other owners, cycles, and graphs past the depth stop.
   * Live rows first (pinned, then recently edited), then archived.
   */
  listIncludeCandidates(parentId: ProcessId): Promise<Process[]>;
  createProcess(input: CreateProcessInput): Promise<Process>;
  updateProcess(
    id: ProcessId,
    patch: Partial<Pick<Process, 'title' | 'notes'>>,
  ): Promise<Process>;
  pinProcess(id: ProcessId): Promise<Process>;
  unpinProcess(id: ProcessId): Promise<Process>;
  archiveProcess(id: ProcessId): Promise<Process>;
  unarchiveProcess(id: ProcessId): Promise<Process>;
  /** Soft delete. Hidden from library and archive. Does not remove include steps that point here. */
  deleteProcess(id: ProcessId): Promise<void>;

  listSteps(processId: ProcessId): Promise<Step[]>;
  createStep(input: CreateStepInput): Promise<Step>;
  updateStep(
    id: string,
    patch: Partial<Pick<Step, 'body' | 'notes' | 'kind' | 'optional' | 'url' | 'position' | 'childProcessId'>>,
  ): Promise<Step>;
  /** Soft delete. Dropped from authoring and from expanded runs. */
  deleteStep(id: string): Promise<void>;

  /** Drops this device's copy. Does not delete the cloud library. */
  clearLocal(): Promise<void>;
}
