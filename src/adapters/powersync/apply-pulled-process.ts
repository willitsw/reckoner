import type { CommonPowerSyncDatabase } from '@powersync/common';

import { decideLww } from '@/src/domain/lww';

/** Row shape as delivered by sync / fake pull (snake_case SQLite columns). */
export type PulledProcessRow = {
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

export type ApplyPulledResult = 'applied' | 'kept_local';

/**
 * Apply a pulled process row with last-write-wins on `updated_at`.
 * Used by tests (fake pull) and as the documented product policy for
 * application-level merge when comparing local vs remote snapshots.
 * Live PowerSync sync still uses the SDK op clock; this matches product LWW.
 */
export async function applyPulledProcess(
  db: CommonPowerSyncDatabase,
  remote: PulledProcessRow,
): Promise<ApplyPulledResult> {
  const local = await db.getOptional<{ updated_at: string }>(
    'SELECT updated_at FROM processes WHERE id = ?',
    [remote.id],
  );

  if (decideLww({ localUpdatedAt: local?.updated_at, remoteUpdatedAt: remote.updated_at }) === 'keep') {
    return 'kept_local';
  }

  if (local) {
    await db.execute(
      `UPDATE processes
       SET owner_id = ?, created_by = ?, updated_by = ?, title = ?, notes = ?,
           pinned_at = ?, archived_at = ?, created_at = ?, updated_at = ?, deleted_at = ?
       WHERE id = ?`,
      [
        remote.owner_id,
        remote.created_by,
        remote.updated_by,
        remote.title,
        remote.notes ?? '',
        remote.pinned_at,
        remote.archived_at,
        remote.created_at,
        remote.updated_at,
        remote.deleted_at,
        remote.id,
      ],
    );
  } else {
    await db.execute(
      `INSERT INTO processes (
        id, owner_id, created_by, updated_by, title, notes,
        pinned_at, archived_at, created_at, updated_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        remote.id,
        remote.owner_id,
        remote.created_by,
        remote.updated_by,
        remote.title,
        remote.notes ?? '',
        remote.pinned_at,
        remote.archived_at,
        remote.created_at,
        remote.updated_at,
        remote.deleted_at,
      ],
    );
  }

  return 'applied';
}
