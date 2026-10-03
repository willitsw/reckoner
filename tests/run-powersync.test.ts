import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import { occurrencePath } from '../src/domain/run';
import { registerRunRepositoryContract } from './contracts/run-contract';
import {
  createPowerSyncLibraryForTests,
  openPowerSyncLibraryAt,
} from './helpers/powersync-test-db';

const openLibs: Array<{ close: () => Promise<void> }> = [];

after(async () => {
  await Promise.all(openLibs.splice(0).map((lib) => lib.close()));
});

registerRunRepositoryContract('powersync-sqlite', async () => {
  const lib = await createPowerSyncLibraryForTests();
  openLibs.push(lib);
  return lib;
});

describe('run PowerSync restart persistence', () => {
  it('keeps in-progress checks after closing and reopening the same SQLite file', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reckoner-ps-restart-'));
    const owner = 'user_1';

    const firstOpen = await openPowerSyncLibraryAt(dir);
    const processRow = await firstOpen.processes.createProcess({
      ownerId: owner,
      title: 'Pack-out',
    });
    const action = await firstOpen.processes.createStep({
      processId: processRow.id,
      body: 'Charge batteries',
    });
    const run = await firstOpen.runs.openRun(processRow.id);
    const checkPath = occurrencePath([action.id]);
    await firstOpen.runs.check(run.id, action.id, checkPath);
    assert.equal((await firstOpen.runs.listChecks(run.id)).length, 1);
    await firstOpen.close();

    const secondOpen = await openPowerSyncLibraryAt(dir);
    openLibs.push({
      close: async () => {
        await secondOpen.close();
        fs.rmSync(dir, { recursive: true, force: true });
      },
    });

    const resumed = await secondOpen.runs.getInProgressRun(processRow.id);
    assert.equal(resumed?.id, run.id);
    const checks = await secondOpen.runs.listChecks(run.id);
    assert.equal(checks.length, 1);
    assert.equal(checks[0]?.occurrencePath, checkPath);
  });
});
