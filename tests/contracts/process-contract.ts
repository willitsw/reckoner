import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { INCLUDE_DEPTH_LIMIT } from '../../src/domain/include';
import { rankBetween } from '../../src/domain/rank';
import type { ProcessRepository } from '../../src/ports/process-repository';

const owner = 'user_1';
const other = 'user_2';

export type ProcessRepositoryFactory = () => Promise<ProcessRepository> | ProcessRepository;

async function seed(repo: ProcessRepository, title: string, ownerId = owner) {
  return repo.createProcess({ ownerId, title });
}

/**
 * ProcessRepository behavioral contract. Run against memory and PowerSync factories.
 */
export function registerProcessRepositoryContract(
  label: string,
  createRepository: ProcessRepositoryFactory,
) {
  describe(`process library (${label})`, () => {
    it('shows only this owner’s live processes, pinned first, then recently edited', async () => {
      const repo = await createRepository();
      const toPin = await seed(repo, 'Glaze');
      const edited = await seed(repo, 'Pack camera');
      await seed(repo, 'Someone else', other);
      await repo.updateProcess(edited.id, { title: 'Pack camera bag' });
      await repo.pinProcess(toPin.id);

      const listed = await repo.listProcesses(owner);
      assert.deepEqual(
        listed.map((process) => process.id),
        [toPin.id, edited.id],
      );
    });

    it('hides an archived process from the library and clears its pin', async () => {
      const repo = await createRepository();
      const process = await seed(repo, 'Bike tune-up');
      await repo.pinProcess(process.id);

      const archived = await repo.archiveProcess(process.id);
      assert.equal(archived.pinnedAt, null);
      assert.ok(archived.archivedAt);
      assert.deepEqual(await repo.listProcesses(owner), []);
      assert.equal((await repo.listArchivedProcesses(owner))[0]?.id, process.id);

      await assert.rejects(() => repo.pinProcess(process.id), /Unarchive/);

      const restored = await repo.unarchiveProcess(process.id);
      assert.equal(restored.archivedAt, null);
      assert.equal(restored.pinnedAt, null);
      assert.equal((await repo.listProcesses(owner))[0]?.id, process.id);
    });

    it('soft-deletes a process so it leaves the library and archive but can still be looked up', async () => {
      const repo = await createRepository();
      const process = await seed(repo, 'Sourdough');
      await repo.archiveProcess(process.id);
      await repo.deleteProcess(process.id);

      assert.deepEqual(await repo.listProcesses(owner), []);
      assert.deepEqual(await repo.listArchivedProcesses(owner), []);
      const loaded = await repo.getProcess(process.id);
      assert.ok(loaded?.deletedAt);
    });

    it('clearLocal drops this device’s process copy', async () => {
      const repo = await createRepository();
      const process = await seed(repo, 'Wipe me');
      await repo.createStep({ processId: process.id, body: 'Gone' });
      await repo.clearLocal();
      assert.equal(await repo.getProcess(process.id), null);
      assert.deepEqual(await repo.listProcesses(owner), []);
      assert.deepEqual(await repo.listSteps(process.id), []);
    });
  });

  describe(`steps (${label})`, () => {
    it('keeps steps in order and drops a deleted step', async () => {
      const repo = await createRepository();
      const process = await seed(repo, 'Pack-out');
      const first = await repo.createStep({ processId: process.id, body: 'Charge batteries' });
      const second = await repo.createStep({ processId: process.id, body: 'Pack lenses' });
      const third = await repo.createStep({ processId: process.id, body: 'Spare cards' });

      assert.deepEqual(
        (await repo.listSteps(process.id)).map((step) => step.body),
        ['Charge batteries', 'Pack lenses', 'Spare cards'],
      );

      const moved = rankBetween(first.position, second.position, '');
      await repo.updateStep(third.id, { position: moved });
      assert.deepEqual(
        (await repo.listSteps(process.id)).map((step) => step.id),
        [first.id, third.id, second.id],
      );

      await repo.deleteStep(third.id);
      assert.deepEqual(
        (await repo.listSteps(process.id)).map((step) => step.id),
        [first.id, second.id],
      );
    });

    it('allows optional only on actions, and only http(s) links', async () => {
      const repo = await createRepository();
      const process = await seed(repo, 'Setup');
      const action = await repo.createStep({
        processId: process.id,
        body: 'Wipe the plate',
        optional: true,
        url: 'https://example.com/wipe',
      });
      assert.equal(action.optional, true);
      assert.equal(action.url, 'https://example.com/wipe');

      const heading = await repo.updateStep(action.id, { kind: 'heading' });
      assert.equal(heading.kind, 'heading');
      assert.equal(heading.optional, false);

      await assert.rejects(
        () => repo.createStep({ processId: process.id, body: 'Note', kind: 'note', optional: true }),
        /action/,
      );
      await assert.rejects(
        () => repo.updateStep(heading.id, { url: 'ftp://files.example' }),
        /http/,
      );
    });

    it('rejects an include that loops or points at a deleted process', async () => {
      const repo = await createRepository();
      const parent = await seed(repo, 'Session');
      const child = await seed(repo, 'Lighting');
      await repo.createStep({ processId: parent.id, body: 'Set lights', childProcessId: child.id });
      await assert.rejects(
        () =>
          repo.createStep({
            processId: child.id,
            body: 'Back to session',
            childProcessId: parent.id,
          }),
        /loop/,
      );

      await repo.deleteProcess(child.id);
      const otherParent = await seed(repo, 'Other setup');
      await assert.rejects(
        () =>
          repo.createStep({
            processId: otherParent.id,
            body: 'Missing lights',
            childProcessId: child.id,
          }),
        /deleted/,
      );
    });
  });

  describe(`include candidates (${label})`, () => {
    it('offers this owner’s live and archived processes, not a loop or someone else', async () => {
      const repo = await createRepository();
      const parent = await seed(repo, 'Session');
      const pinned = await seed(repo, 'Zebra lights');
      const recent = await seed(repo, 'Alpha pack');
      await repo.updateProcess(recent.id, { notes: 'charged' });
      await repo.pinProcess(pinned.id);
      const archived = await seed(repo, 'Old kit');
      await repo.archiveProcess(archived.id);
      await seed(repo, 'Someone else', other);
      const looping = await seed(repo, 'Wraps session');
      await repo.createStep({
        processId: looping.id,
        body: 'Back',
        childProcessId: parent.id,
      });

      const candidates = await repo.listIncludeCandidates(parent.id);
      assert.deepEqual(
        candidates.map((process) => process.id),
        [pinned.id, recent.id, archived.id],
      );

      await repo.createStep({
        processId: parent.id,
        body: 'Lights',
        childProcessId: pinned.id,
      });
      const again = await repo.listIncludeCandidates(parent.id);
      assert.equal(
        again.some((process) => process.id === pinned.id),
        true,
      );
    });

    it('does not offer a target that would nest past the depth stop', async () => {
      const repo = await createRepository();
      const parent = await seed(repo, 'New parent');
      const chain: string[] = [];
      for (let index = 0; index <= INCLUDE_DEPTH_LIMIT; index += 1) {
        chain.push((await seed(repo, `Level ${index}`)).id);
      }
      for (let index = 0; index < INCLUDE_DEPTH_LIMIT; index += 1) {
        await repo.createStep({
          processId: chain[index]!,
          body: 'Next',
          childProcessId: chain[index + 1],
        });
      }

      const candidates = await repo.listIncludeCandidates(parent.id);
      assert.equal(
        candidates.some((process) => process.id === chain[0]),
        false,
      );
      assert.equal(
        candidates.some((process) => process.id === chain[chain.length - 1]),
        true,
      );
    });
  });
}
