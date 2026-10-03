import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PowerSyncDatabase } from '@powersync/node';
import type { CommonPowerSyncDatabase } from '@powersync/common';

import { createPowerSyncProcessRepository } from '../../src/adapters/powersync/process-repository';
import { AppSchema } from '../../src/adapters/powersync/schema';
import type { ProcessRepository } from '../../src/ports/process-repository';

/**
 * Local-only PowerSync DB for contract tests. Temp file; no connect / no cloud.
 */
export async function createPowerSyncProcessRepositoryForTests(): Promise<
  ProcessRepository & { close: () => Promise<void> }
> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reckoner-ps-'));
  const db: CommonPowerSyncDatabase = new PowerSyncDatabase({
    schema: AppSchema,
    database: {
      dbFilename: 'contract.db',
      dbLocation: dir,
    },
  });
  await db.init();
  const repo = createPowerSyncProcessRepository({ db });
  return Object.assign(repo, {
    async close() {
      await db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  });
}
