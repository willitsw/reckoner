import type { CommonPowerSyncDatabase } from '@powersync/common';

import type { ProcessRepository } from '@/src/ports/process-repository';
import type { RunRepository } from '@/src/ports/run-repository';

import { createPowerSyncProcessRepository } from './process-repository';
import { createPowerSyncRunRepository } from './run-repository';

export type PowerSyncLibrary = {
  processes: ProcessRepository;
  runs: RunRepository;
};

export type PowerSyncLibraryOptions =
  | { db: CommonPowerSyncDatabase }
  | { openDb: () => Promise<CommonPowerSyncDatabase> };

/**
 * Process + run adapters on one PowerSync DB (same wipe / schema / connector).
 * Mirrors createMemoryLibrary for the sync path.
 */
export function createPowerSyncLibrary(options: PowerSyncLibraryOptions): PowerSyncLibrary {
  let dbPromise: Promise<CommonPowerSyncDatabase> | null = null;

  function resolveDb(): Promise<CommonPowerSyncDatabase> {
    if ('db' in options) return Promise.resolve(options.db);
    if (!dbPromise) dbPromise = options.openDb();
    return dbPromise;
  }

  const shared = { openDb: resolveDb };
  return {
    processes: createPowerSyncProcessRepository(shared),
    runs: createPowerSyncRunRepository(shared),
  };
}
