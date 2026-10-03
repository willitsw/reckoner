import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createMemoryLibrary } from '../src/adapters/memory/process-repository';

const owner = 'user_1';

describe('definition media', () => {
  it('attaches, lists by process and step group, and soft-deletes without UI', async () => {
    const { processes, media } = createMemoryLibrary();
    const process = await processes.createProcess({ ownerId: owner, title: 'Pack kit' });
    const step = await processes.createStep({ processId: process.id, body: 'Charge batteries' });

    const processImage = await media.attachImage({
      processId: process.id,
      storagePath: 'file:///local/cover.jpg',
      caption: 'Kit overview',
      isCover: true,
    });
    const stepImage = await media.attachImage({
      processId: process.id,
      stepId: step.id,
      storagePath: 'data:image/png;base64,abc',
      caption: 'Battery bay',
    });

    assert.equal(processImage.kind, 'image');
    assert.equal(processImage.isCover, true);
    assert.equal(processImage.stepId, null);
    assert.equal(stepImage.stepId, step.id);

    const forProcess = await media.listForProcess(process.id);
    assert.deepEqual(
      forProcess.map((asset) => asset.id),
      [processImage.id, stepImage.id],
    );

    assert.deepEqual(
      (await media.listForStep(process.id, null)).map((asset) => asset.id),
      [processImage.id],
    );
    assert.deepEqual(
      (await media.listForStep(process.id, step.id)).map((asset) => asset.id),
      [stepImage.id],
    );

    await media.softDelete(stepImage.id);
    assert.deepEqual(
      (await media.listForProcess(process.id)).map((asset) => asset.id),
      [processImage.id],
    );
    assert.deepEqual(await media.listForStep(process.id, step.id), []);
  });

  it('orders siblings by fractional position and updates caption/cover', async () => {
    const { processes, media } = createMemoryLibrary();
    const process = await processes.createProcess({ ownerId: owner, title: 'Glaze' });

    const first = await media.attachImage({
      processId: process.id,
      storagePath: 'local://a',
    });
    const second = await media.attachImage({
      processId: process.id,
      storagePath: 'local://b',
    });
    assert.ok(first.position < second.position);

    const updated = await media.updateMedia(second.id, {
      caption: 'After',
      isCover: true,
    });
    assert.equal(updated.caption, 'After');
    assert.equal(updated.isCover, true);
  });

  it('keeps only one cover per process (latest wins on attach and update)', async () => {
    const { processes, media } = createMemoryLibrary();
    const process = await processes.createProcess({ ownerId: owner, title: 'Cover kit' });
    const step = await processes.createStep({ processId: process.id, body: 'Bay' });

    const first = await media.attachImage({
      processId: process.id,
      storagePath: 'local://cover-a',
      isCover: true,
    });
    const second = await media.attachImage({
      processId: process.id,
      stepId: step.id,
      storagePath: 'local://cover-b',
      isCover: true,
    });

    assert.equal((await media.listForProcess(process.id)).filter((a) => a.isCover).length, 1);
    assert.equal((await media.updateMedia(first.id, {})).isCover, false);
    assert.equal((await media.listForProcess(process.id)).find((a) => a.id === second.id)?.isCover, true);

    await media.updateMedia(first.id, { isCover: true });
    const afterUpdate = await media.listForProcess(process.id);
    assert.deepEqual(
      afterUpdate.filter((a) => a.isCover).map((a) => a.id),
      [first.id],
    );
    assert.equal(afterUpdate.find((a) => a.id === second.id)?.isCover, false);
  });

  it('rejects attach to an unknown or deleted process, and mismatched steps', async () => {
    const { processes, media } = createMemoryLibrary();
    const process = await processes.createProcess({ ownerId: owner, title: 'Guards' });
    const other = await processes.createProcess({ ownerId: owner, title: 'Other' });
    const step = await processes.createStep({ processId: other.id, body: 'Wrong parent' });

    await assert.rejects(
      () => media.attachImage({ processId: 'missing_process', storagePath: 'local://x' }),
      /Process not found/,
    );

    await processes.deleteProcess(process.id);
    await assert.rejects(
      () => media.attachImage({ processId: process.id, storagePath: 'local://x' }),
      /deleted process/i,
    );

    await assert.rejects(
      () =>
        media.attachImage({
          processId: other.id,
          stepId: 'missing_step',
          storagePath: 'local://x',
        }),
      /Step not found/,
    );

    await assert.rejects(
      () =>
        media.attachImage({
          processId: process.id,
          stepId: step.id,
          storagePath: 'local://x',
        }),
      /deleted process|does not belong/i,
    );

    const live = await processes.createProcess({ ownerId: owner, title: 'Live' });
    await assert.rejects(
      () =>
        media.attachImage({
          processId: live.id,
          stepId: step.id,
          storagePath: 'local://x',
        }),
      /does not belong/,
    );
  });

  it('clearLocal wipes media with the shared library', async () => {
    const { processes, media } = createMemoryLibrary();
    const process = await processes.createProcess({ ownerId: owner, title: 'Wipe me' });
    await media.attachImage({ processId: process.id, storagePath: 'local://x' });

    await processes.clearLocal();
    assert.deepEqual(await media.listForProcess(process.id), []);
  });

  it('media.clearLocal empties media without requiring process wipe first', async () => {
    const { processes, media } = createMemoryLibrary();
    const process = await processes.createProcess({ ownerId: owner, title: 'Media only' });
    await media.attachImage({ processId: process.id, storagePath: 'local://y' });

    await media.clearLocal();
    assert.deepEqual(await media.listForProcess(process.id), []);
    assert.ok(await processes.getProcess(process.id));
  });
});
