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

describe('definition audio', () => {
  it('attaches audio to process and step, lists, and soft-deletes', async () => {
    const { processes, media } = createMemoryLibrary();
    const process = await processes.createProcess({ ownerId: owner, title: 'Voice notes' });
    const step = await processes.createStep({ processId: process.id, body: 'Listen first' });

    const processAudio = await media.attachAudio({
      processId: process.id,
      storagePath: 'file:///local/intro.m4a',
      contentType: 'audio/mp4',
      caption: 'Overview',
    });
    const stepAudio = await media.attachAudio({
      processId: process.id,
      stepId: step.id,
      storagePath: 'file:///local/step.m4a',
      caption: 'Detail',
    });

    assert.equal(processAudio.kind, 'audio');
    assert.equal(processAudio.isCover, false);
    assert.equal(processAudio.stepId, null);
    assert.equal(processAudio.storagePath, 'file:///local/intro.m4a');
    assert.equal(stepAudio.kind, 'audio');
    assert.equal(stepAudio.stepId, step.id);

    const forProcess = await media.listForProcess(process.id);
    assert.deepEqual(
      forProcess.map((asset) => asset.id),
      [processAudio.id, stepAudio.id],
    );
    assert.deepEqual(
      (await media.listForStep(process.id, null)).map((asset) => asset.id),
      [processAudio.id],
    );
    assert.deepEqual(
      (await media.listForStep(process.id, step.id)).map((asset) => asset.id),
      [stepAudio.id],
    );

    await media.softDelete(stepAudio.id);
    assert.deepEqual(
      (await media.listForProcess(process.id)).map((asset) => asset.id),
      [processAudio.id],
    );
    assert.deepEqual(await media.listForStep(process.id, step.id), []);
  });

  it('never treats audio as cover on attach or update', async () => {
    const { processes, media } = createMemoryLibrary();
    const process = await processes.createProcess({ ownerId: owner, title: 'Cover guard' });
    const coverImage = await media.attachImage({
      processId: process.id,
      storagePath: 'local://cover.jpg',
      isCover: true,
    });

    await assert.rejects(
      () =>
        media.attachAudio({
          processId: process.id,
          storagePath: 'file:///local/no-cover.m4a',
          // @ts-expect-error audio attach must not accept isCover
          isCover: true,
        }),
      /cover|isCover|image/i,
    );

    const audio = await media.attachAudio({
      processId: process.id,
      storagePath: 'file:///local/voice.m4a',
    });
    assert.equal(audio.isCover, false);

    await assert.rejects(
      () => media.updateMedia(audio.id, { isCover: true }),
      /Only an image can be cover/,
    );

    assert.equal(
      (await media.listForProcess(process.id)).find((a) => a.id === coverImage.id)?.isCover,
      true,
    );
    assert.equal(
      (await media.listForProcess(process.id)).find((a) => a.id === audio.id)?.isCover,
      false,
    );
  });

  it('lists images and audio together; clearLocal wipes both', async () => {
    const { processes, media } = createMemoryLibrary();
    const process = await processes.createProcess({ ownerId: owner, title: 'Mixed media' });

    const image = await media.attachImage({
      processId: process.id,
      storagePath: 'local://pic.jpg',
    });
    const audio = await media.attachAudio({
      processId: process.id,
      storagePath: 'file:///local/note.m4a',
    });

    const listed = await media.listForProcess(process.id);
    assert.deepEqual(
      listed.map((asset) => [asset.id, asset.kind]),
      [
        [image.id, 'image'],
        [audio.id, 'audio'],
      ],
    );

    await media.clearLocal();
    assert.deepEqual(await media.listForProcess(process.id), []);
    assert.ok(await processes.getProcess(process.id));
  });
});
