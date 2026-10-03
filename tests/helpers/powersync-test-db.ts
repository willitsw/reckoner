import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PowerSyncDatabase } from '@powersync/node';
import type { CommonPowerSyncDatabase } from '@powersync/common';

import { createPowerSyncProcessRepository } from '../../src/adapters/powersync/process-repository';
import { createPowerSyncRunRepository } from '../../src/adapters/powersync/run-repository';
import { AppSchema } from '../../src/adapters/powersync/schema';
import type { ProcessRepository } from '../../src/ports/process-repository';
import type { RunRepository } from '../../src/ports/run-repository';
import type { RunLibrary } from '../contracts/run-contract';

type Closeable = { close: () => Promise<void> };

async function openLocalPowerSyncDb(dir: string): Promise<CommonPowerSyncDatabase> {
  const db: CommonPowerSyncDatabase = new PowerSyncDatabase({
    schema: AppSchema,
    database: {
      dbFilename: 'contract.db',
      dbLocation: dir,
    },
  });
  await db.init();
  return db;
}

/**
 * Local-only PowerSync DB for contract tests. Temp file; no connect / no cloud.
 */
export async function createPowerSyncProcessRepositoryForTests(): Promise<
  ProcessRepository & Closeable
> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reckoner-ps-'));
  const db = await openLocalPowerSyncDb(dir);
  const repo = createPowerSyncProcessRepository({ db });
  return Object.assign(repo, {
    async close() {
      await db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  });
}

/**
 * Shared process + run adapters on one local PowerSync SQLite file (same wipe/DB).
 */
export async function createPowerSyncLibraryForTests(): Promise<
  RunLibrary & { db: CommonPowerSyncDatabase } & Closeable
> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reckoner-ps-lib-'));
  const db = await openLocalPowerSyncDb(dir);
  return {
    processes: createPowerSyncProcessRepository({ db }),
    runs: createPowerSyncRunRepository({ db }),
    db,
    async close() {
      await db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

/**
 * Open a library at a fixed path (for restart / reopen persistence checks).
 */
export async function openPowerSyncLibraryAt(
  dir: string,
): Promise<RunLibrary & { db: CommonPowerSyncDatabase } & Closeable> {
  fs.mkdirSync(dir, { recursive: true });
  const db = await openLocalPowerSyncDb(dir);
  return {
    processes: createPowerSyncProcessRepository({ db }),
    runs: createPowerSyncRunRepository({ db }),
    db,
    async close() {
      await db.close();
    },
  };
}

export type { RunRepository };
