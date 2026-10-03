import type { CommonPowerSyncDatabase } from '@powersync/common';

import { stepIdFromPath } from '@/src/domain/run';
import type { ProcessId, Run, RunCheck, RunId, RunStatus, StepId } from '@/src/domain/types';
import type { RunRepository } from '@/src/ports/run-repository';

type ProcessRow = {
  id: string;
  owner_id: string;
  deleted_at: string | null;
};

type StepRow = {
  id: string;
  owner_id: string;
  kind: string;
  deleted_at: string | null;
};

type RunRow = {
  id: string;
  owner_id: string;
  created_by: string | null;
  updated_by: string | null;
  process_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type RunCheckRow = {
  id: string;
  owner_id: string;
  created_by: string | null;
  updated_by: string | null;
  run_id: string;
  step_id: string;
  occurrence_path: string;
  checked_at: string;
  created_at: string;
  updated_at: string;
};

function nowIso() {
  return new Date().toISOString();
}

function newId(): string {
  return globalThis.crypto.randomUUID();
}

function mapRun(row: RunRow): Run {
  return {
    id: row.id,
    processId: row.process_id,
    ownerId: row.owner_id,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    status: row.status as RunStatus,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCheck(row: RunCheckRow): RunCheck {
  return {
    id: row.id,
    runId: row.run_id,
    stepId: row.step_id,
    ownerId: row.owner_id,
    occurrencePath: row.occurrence_path,
    checkedAt: row.checked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type PowerSyncRunRepositoryOptions =
  | { db: CommonPowerSyncDatabase }
  | { openDb: () => Promise<CommonPowerSyncDatabase> };

/**
 * RunRepository over a PowerSync-managed SQLite database.
 * Shares AppSchema / DB with the process adapter. Uncheck = hard DELETE.
 */
export function createPowerSyncRunRepository(
  options: PowerSyncRunRepositoryOptions,
): RunRepository {
  let dbPromise: Promise<CommonPowerSyncDatabase> | null = null;

  function resolveDb(): Promise<CommonPowerSyncDatabase> {
    if ('db' in options) return Promise.resolve(options.db);
    if (!dbPromise) dbPromise = options.openDb();
    return dbPromise;
  }

  async function inProgressRun(
    db: CommonPowerSyncDatabase,
    processId: ProcessId,
  ): Promise<Run | null> {
    const row = await db.getOptional<RunRow>(
      `SELECT * FROM runs WHERE process_id = ? AND status = 'in_progress'`,
      [processId],
    );
    return row ? mapRun(row) : null;
  }

  async function requireRun(db: CommonPowerSyncDatabase, runId: RunId): Promise<RunRow> {
    const row = await db.getOptional<RunRow>('SELECT * FROM runs WHERE id = ?', [runId]);
    if (!row || row.status !== 'in_progress') {
      throw new Error('That run is no longer in progress.');
    }
    return row;
  }

  async function discardInProgress(db: CommonPowerSyncDatabase, processId: ProcessId) {
    const timestamp = nowIso();
    await db.execute(
      `UPDATE runs
       SET status = 'discarded', completed_at = NULL, updated_at = ?
       WHERE process_id = ? AND status = 'in_progress'`,
      [timestamp, processId],
    );
  }

  const repository: RunRepository = {
    async getInProgressRun(processId) {
      const db = await resolveDb();
      return inProgressRun(db, processId);
    },

    async openRun(processId) {
      const db = await resolveDb();
      const existing = await inProgressRun(db, processId);
      if (existing) return existing;

      const process = await db.getOptional<ProcessRow>('SELECT * FROM processes WHERE id = ?', [
        processId,
      ]);
      if (!process) throw new Error(`Process not found: ${processId}`);
      if (process.deleted_at) throw new Error('A deleted process cannot be run.');

      const timestamp = nowIso();
      const id = newId();
      await db.execute(
        `INSERT INTO runs (
          id, owner_id, created_by, updated_by, process_id, status,
          started_at, completed_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'in_progress', ?, NULL, ?, ?)`,
        [
          id,
          process.owner_id,
          process.owner_id,
          process.owner_id,
          processId,
          timestamp,
          timestamp,
          timestamp,
        ],
      );
      const row = await db.getOptional<RunRow>('SELECT * FROM runs WHERE id = ?', [id]);
      if (!row) throw new Error(`Run not found: ${id}`);
      return mapRun(row);
    },

    async listChecks(runId) {
      const db = await resolveDb();
      const rows = await db.getAll<RunCheckRow>(`SELECT * FROM run_checks WHERE run_id = ?`, [
        runId,
      ]);
      return rows
        .map(mapCheck)
        .sort((a, b) => a.occurrencePath.localeCompare(b.occurrencePath));
    },

    async check(runId, stepId: StepId, occurrencePath: string) {
      const db = await resolveDb();
      const run = await requireRun(db, runId);

      const step = await db.getOptional<StepRow>('SELECT * FROM steps WHERE id = ?', [stepId]);
      if (!step || step.deleted_at) throw new Error('That step is not available.');
      if (step.kind !== 'action') throw new Error('Only an action can be checked.');
      if (step.owner_id !== run.owner_id) throw new Error('You can only check a step you own.');
      if (stepIdFromPath(occurrencePath) !== stepId) {
        throw new Error('That check does not match the step.');
      }

      const existing = await db.getOptional<RunCheckRow>(
        `SELECT * FROM run_checks WHERE run_id = ? AND occurrence_path = ?`,
        [runId, occurrencePath],
      );
      if (existing) return mapCheck(existing);

      const timestamp = nowIso();
      const id = newId();
      await db.execute(
        `INSERT INTO run_checks (
          id, owner_id, created_by, updated_by, run_id, step_id,
          occurrence_path, checked_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          run.owner_id,
          run.owner_id,
          run.owner_id,
          runId,
          stepId,
          occurrencePath,
          timestamp,
          timestamp,
          timestamp,
        ],
      );
      const row = await db.getOptional<RunCheckRow>('SELECT * FROM run_checks WHERE id = ?', [id]);
      if (!row) throw new Error(`Run check not found: ${id}`);
      return mapCheck(row);
    },

    async uncheck(runId, occurrencePath) {
      const db = await resolveDb();
      await requireRun(db, runId);
      await db.execute(`DELETE FROM run_checks WHERE run_id = ? AND occurrence_path = ?`, [
        runId,
        occurrencePath,
      ]);
    },

    async startAgain(processId) {
      const db = await resolveDb();
      await discardInProgress(db, processId);
      return repository.openRun(processId);
    },
  };

  return repository;
}
