import type { ProcessId, Run, RunCheck, RunId, StepId } from '@/src/domain/types';

/**
 * Completion for one use of a process. Checking does not change run status.
 * At most one in-progress run per process.
 */
export interface RunRepository {
  getInProgressRun(processId: ProcessId): Promise<Run | null>;
  /** Returns the in-progress run, creating it on first open. */
  openRun(processId: ProcessId): Promise<Run>;
  listChecks(runId: RunId): Promise<RunCheck[]>;
  /** Idempotent for the same path. Headings and notes are rejected. */
  check(runId: RunId, stepId: StepId, occurrencePath: string): Promise<RunCheck>;
  /** Uncheck deletes the row. Missing row is a no-op. */
  uncheck(runId: RunId, occurrencePath: string): Promise<void>;
  /**
   * Discards the in-progress run and opens a fresh one with no checks.
   * The discarded run keeps its checks for later history.
   */
  startAgain(processId: ProcessId): Promise<Run>;
}
