import type { CommonPowerSyncDatabase } from '@powersync/common';

import { liveIncludeError } from '@/src/domain/include';
import { rankBetween } from '@/src/domain/rank';
import type { Process, ProcessId, Step, StepKind, UserId } from '@/src/domain/types';
import { normalizeUrl } from '@/src/domain/url';
import type {
  CreateProcessInput,
  CreateStepInput,
  ProcessRepository,
} from '@/src/ports/process-repository';

type ProcessRow = {
  id: string;
  owner_id: string;
  created_by: string | null;
  updated_by: string | null;
  title: string;
  notes: string | null;
  pinned_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type StepRow = {
  id: string;
  process_id: string;
  owner_id: string;
  created_by: string | null;
  updated_by: string | null;
  position: string;
  kind: string;
  optional: number | null;
  body: string;
  notes: string | null;
  url: string | null;
  child_process_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

function newId(): string {
  return globalThis.crypto.randomUUID();
}

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

function mapProcess(row: ProcessRow): Process {
  return {
    id: row.id,
    ownerId: row.owner_id,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    title: row.title,
    notes: row.notes ?? '',
    pinnedAt: row.pinned_at,
    archivedAt: row.archived_at,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStep(row: StepRow): Step {
  return {
    id: row.id,
    processId: row.process_id,
    ownerId: row.owner_id,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    position: row.position,
    kind: row.kind as StepKind,
    optional: row.optional === 1,
    body: row.body,
    notes: row.notes ?? '',
    url: row.url,
    childProcessId: row.child_process_id,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type PowerSyncProcessRepositoryOptions =
  | { db: CommonPowerSyncDatabase }
  | { openDb: () => Promise<CommonPowerSyncDatabase> };

/**
 * ProcessRepository over a PowerSync-managed SQLite database.
 * Local CRUD works without connect(); clearLocal disconnects and wipes.
 */
export function createPowerSyncProcessRepository(
  options: PowerSyncProcessRepositoryOptions,
): ProcessRepository {
  let dbPromise: Promise<CommonPowerSyncDatabase> | null = null;

  function resolveDb(): Promise<CommonPowerSyncDatabase> {
    if ('db' in options) return Promise.resolve(options.db);
    if (!dbPromise) dbPromise = options.openDb();
    return dbPromise;
  }

  async function requireProcessRow(
    db: CommonPowerSyncDatabase,
    processId: ProcessId,
  ): Promise<ProcessRow> {
    const row = await db.getOptional<ProcessRow>('SELECT * FROM processes WHERE id = ?', [
      processId,
    ]);
    if (!row) throw new Error(`Process not found: ${processId}`);
    return row;
  }

  async function liveIncludeEdges(db: CommonPowerSyncDatabase) {
    const rows = await db.getAll<{ process_id: string; child_process_id: string }>(
      `SELECT process_id, child_process_id FROM steps
       WHERE deleted_at IS NULL AND child_process_id IS NOT NULL`,
    );
    return rows.map((row) => ({
      processId: row.process_id,
      childProcessId: row.child_process_id,
    }));
  }

  async function guardInclude(
    db: CommonPowerSyncDatabase,
    processId: ProcessId,
    childProcessId: ProcessId | null,
  ) {
    if (!childProcessId) return;
    const parent = await requireProcessRow(db, processId);
    const child = await db.getOptional<ProcessRow>('SELECT * FROM processes WHERE id = ?', [
      childProcessId,
    ]);
    const error = liveIncludeError({
      parentId: processId,
      childId: childProcessId,
      parentOwnerId: parent.owner_id,
      child: child ? { ownerId: child.owner_id, deletedAt: child.deleted_at } : null,
      edges: await liveIncludeEdges(db),
    });
    if (error) throw new Error(error);
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

  return {
    async listProcesses(ownerId: UserId) {
      const db = await resolveDb();
      const rows = await db.getAll<ProcessRow>(
        `SELECT * FROM processes
         WHERE owner_id = ? AND deleted_at IS NULL AND archived_at IS NULL`,
        [ownerId],
      );
      return rows.map(mapProcess).sort(compareLibrary);
    },

    async listArchivedProcesses(ownerId: UserId) {
      const db = await resolveDb();
      const rows = await db.getAll<ProcessRow>(
        `SELECT * FROM processes
         WHERE owner_id = ? AND deleted_at IS NULL AND archived_at IS NOT NULL`,
        [ownerId],
      );
      return rows
        .map(mapProcess)
        .sort(
          (a, b) =>
            b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title),
        );
    },

    async getProcess(processId) {
      const db = await resolveDb();
      const row = await db.getOptional<ProcessRow>('SELECT * FROM processes WHERE id = ?', [
        processId,
      ]);
      return row ? mapProcess(row) : null;
    },

    async listIncludeCandidates(parentId) {
      const db = await resolveDb();
      const parent = await requireProcessRow(db, parentId);
      const edges = await liveIncludeEdges(db);
      const rows = await db.getAll<ProcessRow>(
        `SELECT * FROM processes WHERE owner_id = ? AND deleted_at IS NULL`,
        [parent.owner_id],
      );
      const candidates = rows.map(mapProcess).filter((process) => {
        return (
          liveIncludeError({
            parentId,
            childId: process.id,
            parentOwnerId: parent.owner_id,
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
      const db = await resolveDb();
      const timestamp = nowIso();
      const id = newId();
      await db.execute(
        `INSERT INTO processes (
          id, owner_id, created_by, updated_by, title, notes,
          pinned_at, archived_at, created_at, updated_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, NULL)`,
        [
          id,
          input.ownerId,
          input.ownerId,
          input.ownerId,
          input.title,
          input.notes ?? '',
          timestamp,
          timestamp,
        ],
      );
      return mapProcess(await requireProcessRow(db, id));
    },

    async updateProcess(processId, patch) {
      const db = await resolveDb();
      const existing = await requireProcessRow(db, processId);
      const timestamp = nowIso();
      const title = patch.title ?? existing.title;
      const notes = patch.notes ?? existing.notes ?? '';
      await db.execute(
        `UPDATE processes
         SET title = ?, notes = ?, updated_by = ?, updated_at = ?
         WHERE id = ?`,
        [title, notes, existing.owner_id, timestamp, processId],
      );
      return mapProcess(await requireProcessRow(db, processId));
    },

    async pinProcess(processId) {
      const db = await resolveDb();
      const existing = await requireProcessRow(db, processId);
      if (existing.deleted_at) throw new Error('A deleted process cannot be pinned.');
      if (existing.archived_at) throw new Error('Unarchive this process before pinning it.');
      const timestamp = nowIso();
      await db.execute(
        `UPDATE processes
         SET pinned_at = ?, updated_by = ?, updated_at = ?
         WHERE id = ?`,
        [timestamp, existing.owner_id, timestamp, processId],
      );
      return mapProcess(await requireProcessRow(db, processId));
    },

    async unpinProcess(processId) {
      const db = await resolveDb();
      const existing = await requireProcessRow(db, processId);
      if (existing.deleted_at) throw new Error('A deleted process cannot be pinned.');
      const timestamp = nowIso();
      await db.execute(
        `UPDATE processes
         SET pinned_at = NULL, updated_by = ?, updated_at = ?
         WHERE id = ?`,
        [existing.owner_id, timestamp, processId],
      );
      return mapProcess(await requireProcessRow(db, processId));
    },

    async archiveProcess(processId) {
      const db = await resolveDb();
      const existing = await requireProcessRow(db, processId);
      if (existing.deleted_at) throw new Error('A deleted process cannot be archived.');
      if (existing.archived_at) return mapProcess(existing);
      const timestamp = nowIso();
      await db.execute(
        `UPDATE processes
         SET archived_at = ?, pinned_at = NULL, updated_by = ?, updated_at = ?
         WHERE id = ?`,
        [timestamp, existing.owner_id, timestamp, processId],
      );
      return mapProcess(await requireProcessRow(db, processId));
    },

    async unarchiveProcess(processId) {
      const db = await resolveDb();
      const existing = await requireProcessRow(db, processId);
      if (existing.deleted_at) {
        throw new Error('A deleted process cannot be restored from the archive.');
      }
      const timestamp = nowIso();
      await db.execute(
        `UPDATE processes
         SET archived_at = NULL, updated_by = ?, updated_at = ?
         WHERE id = ?`,
        [existing.owner_id, timestamp, processId],
      );
      return mapProcess(await requireProcessRow(db, processId));
    },

    async deleteProcess(processId) {
      const db = await resolveDb();
      const existing = await db.getOptional<ProcessRow>('SELECT * FROM processes WHERE id = ?', [
        processId,
      ]);
      if (!existing || existing.deleted_at) return;
      await discardInProgress(db, processId);
      const timestamp = nowIso();
      await db.execute(
        `UPDATE processes
         SET deleted_at = ?, updated_by = ?, updated_at = ?
         WHERE id = ?`,
        [timestamp, existing.owner_id, timestamp, processId],
      );
    },

    async listSteps(processId) {
      const db = await resolveDb();
      const rows = await db.getAll<StepRow>(
        `SELECT * FROM steps WHERE process_id = ? AND deleted_at IS NULL`,
        [processId],
      );
      return rows
        .map(mapStep)
        .sort((a, b) => compareRank(a.position, b.position) || compareRank(a.id, b.id));
    },

    async createStep(input: CreateStepInput) {
      const db = await resolveDb();
      const process = await requireProcessRow(db, input.processId);
      if (process.deleted_at) throw new Error('A deleted process cannot take new steps.');

      const kind: StepKind = input.kind ?? 'action';
      if (kind !== 'action' && (input.optional || input.childProcessId)) {
        throw new Error('Only an action can be optional or include a process.');
      }
      const childProcessId = input.childProcessId ?? null;
      const optional = input.optional ?? false;
      await guardInclude(db, input.processId, childProcessId);

      const siblings = await db.getAll<{ position: string }>(
        `SELECT position FROM steps WHERE process_id = ? AND deleted_at IS NULL`,
        [input.processId],
      );
      const last = siblings.map((s) => s.position).sort(compareRank).at(-1) ?? null;
      const position = input.position ?? rankBetween(last, null);
      const timestamp = nowIso();
      const id = newId();
      await db.execute(
        `INSERT INTO steps (
          id, process_id, owner_id, created_by, updated_by, position, kind, optional,
          body, notes, url, child_process_id, created_at, updated_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [
          id,
          input.processId,
          process.owner_id,
          process.owner_id,
          process.owner_id,
          position,
          kind,
          optional ? 1 : 0,
          input.body,
          input.notes ?? '',
          normalizeUrl(input.url),
          childProcessId,
          timestamp,
          timestamp,
        ],
      );
      const row = await db.getOptional<StepRow>('SELECT * FROM steps WHERE id = ?', [id]);
      if (!row) throw new Error(`Step not found: ${id}`);
      return mapStep(row);
    },

    async updateStep(stepId, patch) {
      const db = await resolveDb();
      const existing = await db.getOptional<StepRow>('SELECT * FROM steps WHERE id = ?', [stepId]);
      if (!existing) throw new Error(`Step not found: ${stepId}`);

      const kind: StepKind = patch.kind ?? (existing.kind as StepKind);
      const leavingAction = kind !== 'action';
      const childProcessId = leavingAction
        ? null
        : patch.childProcessId !== undefined
          ? patch.childProcessId
          : existing.child_process_id;
      const optional = leavingAction
        ? false
        : patch.optional !== undefined
          ? patch.optional
          : existing.optional === 1;

      if (optional && kind !== 'action') {
        throw new Error('Only an action can be optional.');
      }
      if (childProcessId && kind !== 'action') {
        throw new Error('Only an action can include a process.');
      }
      if (childProcessId && childProcessId !== existing.child_process_id) {
        await guardInclude(db, existing.process_id, childProcessId);
      }

      const url = patch.url !== undefined ? normalizeUrl(patch.url) : existing.url;
      const body = patch.body ?? existing.body;
      const notes = patch.notes ?? existing.notes ?? '';
      const position = patch.position ?? existing.position;
      const timestamp = nowIso();

      await db.execute(
        `UPDATE steps
         SET body = ?, notes = ?, kind = ?, optional = ?, url = ?, position = ?,
             child_process_id = ?, updated_by = ?, updated_at = ?
         WHERE id = ?`,
        [
          body,
          notes,
          kind,
          optional ? 1 : 0,
          url,
          position,
          childProcessId,
          existing.owner_id,
          timestamp,
          stepId,
        ],
      );
      const row = await db.getOptional<StepRow>('SELECT * FROM steps WHERE id = ?', [stepId]);
      if (!row) throw new Error(`Step not found: ${stepId}`);
      return mapStep(row);
    },

    async deleteStep(stepId) {
      const db = await resolveDb();
      const existing = await db.getOptional<StepRow>('SELECT * FROM steps WHERE id = ?', [stepId]);
      if (!existing || existing.deleted_at) return;
      const timestamp = nowIso();
      await db.execute(
        `UPDATE steps
         SET deleted_at = ?, updated_by = ?, updated_at = ?
         WHERE id = ?`,
        [timestamp, existing.owner_id, timestamp, stepId],
      );
    },

    async clearLocal() {
      const db = await resolveDb();
      await db.disconnectAndClear();
    },
  };
}
