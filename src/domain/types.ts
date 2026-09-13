/**
 * Domain types — pure, no I/O.
 * Product noun: Process (provisional). See .plans/vocabulary.md
 * Table shape: supabase/migrations/init_data_model.sql
 */

export type Plan = 'free' | 'paid';

export type ProcessId = string;
export type StepId = string;
export type RunId = string;
export type MediaId = string;
export type UserId = string;

export type StepKind = 'action' | 'heading' | 'note';
export type MediaKind = 'image' | 'audio';
export type RunStatus = 'in_progress' | 'completed' | 'discarded';

export type Process = {
  id: ProcessId;
  ownerId: UserId;
  createdBy: UserId | null;
  updatedBy: UserId | null;
  title: string;
  notes: string;
  /** Null means not pinned. Library sorts pinned first. */
  pinnedAt: string | null;
  /** Hidden from the default library. Still a valid include target. */
  archivedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Step = {
  id: StepId;
  processId: ProcessId;
  ownerId: UserId;
  createdBy: UserId | null;
  updatedBy: UserId | null;
  /** Lexicographic fractional rank. Not unique; sort ties by id. */
  position: string;
  kind: StepKind;
  /** Only actions. Optional steps do not block parent completion. */
  optional: boolean;
  body: string;
  notes: string;
  /** http(s) only, or null. */
  url: string | null;
  /** Live include. Only set when kind is action. */
  childProcessId: ProcessId | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MediaAsset = {
  id: MediaId;
  ownerId: UserId;
  createdBy: UserId | null;
  updatedBy: UserId | null;
  processId: ProcessId;
  stepId: StepId | null;
  kind: MediaKind;
  storagePath: string;
  contentType: string | null;
  byteSize: number | null;
  caption: string;
  position: string;
  isCover: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Run = {
  id: RunId;
  processId: ProcessId;
  ownerId: UserId;
  createdBy: UserId | null;
  updatedBy: UserId | null;
  status: RunStatus;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** A row means checked. Uncheck deletes it. */
export type RunCheck = {
  id: string;
  runId: RunId;
  stepId: StepId;
  ownerId: UserId;
  occurrencePath: string;
  checkedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type SessionUser = {
  id: UserId;
  email: string | null;
};

/** Signed-in account. Identity from auth; name and plan from profiles. */
export type Account = {
  id: UserId;
  email: string | null;
  displayName: string | null;
  plan: Plan;
  createdAt: string | null;
};
