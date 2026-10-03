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

  it('clearLocal wipes media with the shared library', async () => {
    const { processes, media } = createMemoryLibrary();
    const process = await processes.createProcess({ ownerId: owner, title: 'Wipe me' });
    await media.attachImage({ processId: process.id, storagePath: 'local://x' });

    await processes.clearLocal();
    assert.deepEqual(await media.listForProcess(process.id), []);
  });
});
