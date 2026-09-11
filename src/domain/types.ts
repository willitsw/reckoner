/**
 * Domain types — pure, no I/O.
 * Product noun: Process (provisional). See .plans/vocabulary.md
 */

export type Plan = 'free' | 'paid';

export type ProcessId = string;
export type StepId = string;
export type RunId = string;
export type UserId = string;

export type Process = {
  id: ProcessId;
  ownerId: UserId;
  title: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type Step = {
  id: StepId;
  processId: ProcessId;
  position: number;
  body: string;
  notes: string;
  /** Live include of another process; null for a plain step. */
  childProcessId: ProcessId | null;
};

export type RunStatus = 'in_progress' | 'completed' | 'discarded';

export type Run = {
  id: RunId;
  processId: ProcessId;
  ownerId: UserId;
  status: RunStatus;
  startedAt: string;
  completedAt: string | null;
  updatedAt: string;
};

export type RunStep = {
  id: string;
  runId: RunId;
  stepId: StepId;
  checked: boolean;
  checkedAt: string | null;
};

export type SessionUser = {
  id: UserId;
  email: string | null;
};
