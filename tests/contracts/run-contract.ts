import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { occurrencePath } from '../../src/domain/run';
import type { ProcessRepository } from '../../src/ports/process-repository';
import type { RunRepository } from '../../src/ports/run-repository';

const owner = 'user_1';

export type RunLibrary = {
  processes: ProcessRepository;
  runs: RunRepository;
};

export type RunLibraryFactory = () => Promise<RunLibrary> | RunLibrary;

/**
 * RunRepository behavioral contract. Run against memory and PowerSync factories.
 * Factories must share process + run stores so deleteProcess discards in-progress runs.
 */
export function registerRunRepositoryContract(label: string, createLibrary: RunLibraryFactory) {
  describe(`runs (${label})`, () => {
    it('keeps one in-progress run, stores checks by path, and keeps them after start again', async () => {
      const { processes, runs } = await createLibrary();
      const processRow = await processes.createProcess({ ownerId: owner, title: 'Pack-out' });
      const action = await processes.createStep({ processId: processRow.id, body: 'Charge batteries' });
      const heading = await processes.createStep({
        processId: processRow.id,
        body: 'Kit',
        kind: 'heading',
      });

      const first = await runs.openRun(processRow.id);
      const again = await runs.openRun(processRow.id);
      assert.equal(again.id, first.id);

      const path = occurrencePath([action.id]);
      await runs.check(first.id, action.id, path);
      await runs.check(first.id, action.id, path);
      assert.equal((await runs.listChecks(first.id)).length, 1);

      await assert.rejects(
        () => runs.check(first.id, heading.id, occurrencePath([heading.id])),
        /action/,
      );

      const next = await runs.startAgain(processRow.id);
      assert.notEqual(next.id, first.id);
      assert.equal((await runs.listChecks(next.id)).length, 0);
      assert.equal((await runs.listChecks(first.id)).length, 1);
      await assert.rejects(() => runs.check(first.id, action.id, path), /in progress/);
      assert.equal((await runs.getInProgressRun(processRow.id))?.id, next.id);
    });

    it('discards the in-progress run when the process is deleted', async () => {
      const { processes, runs } = await createLibrary();
      const processRow = await processes.createProcess({ ownerId: owner, title: 'Glaze' });
      const opened = await runs.openRun(processRow.id);
      await processes.deleteProcess(processRow.id);

      assert.equal(await runs.getInProgressRun(processRow.id), null);
      await assert.rejects(() => runs.check(opened.id, 'missing', '/missing'), /in progress/);
      await assert.rejects(() => runs.openRun(processRow.id), /deleted/);
    });

    it('unchecks by deleting the run_checks row', async () => {
      const { processes, runs } = await createLibrary();
      const processRow = await processes.createProcess({ ownerId: owner, title: 'Pack' });
      const action = await processes.createStep({ processId: processRow.id, body: 'Pack bag' });
      const run = await runs.openRun(processRow.id);
      const path = occurrencePath([action.id]);

      await runs.check(run.id, action.id, path);
      assert.equal((await runs.listChecks(run.id)).length, 1);

      await runs.uncheck(run.id, path);
      assert.equal((await runs.listChecks(run.id)).length, 0);

      await runs.uncheck(run.id, path);
      assert.equal((await runs.listChecks(run.id)).length, 0);
    });
  });
}
