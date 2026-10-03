import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createMemoryLibrary } from '../src/adapters/memory/process-repository';
import type { MediaAsset } from '../src/domain/types';
import {
  definitionAudio,
  definitionImages,
} from '../src/modules/process/split-definition-media';

const owner = 'user_1';

/**
 * Editor attach path for definition audio: after capture/pick, call
 * MediaRepository.attachAudio (not MediaUploadQueue — image-only for now).
 * Soft-delete + caption; never cover.
 */
describe('definition audio editor attach (memory)', () => {
  it('attaches process and step audio, splits from images, captions, and soft-deletes', async () => {
    const { processes, media } = createMemoryLibrary();
    const process = await processes.createProcess({ ownerId: owner, title: 'Voice how-to' });
    const step = await processes.createStep({ processId: process.id, body: 'Hear this' });

    await media.attachImage({
      processId: process.id,
      storagePath: 'file:///local/cover.jpg',
      isCover: true,
    });

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
      contentType: 'audio/mp4',
    });

    const all = await media.listForProcess(process.id);
    const processLevel = all.filter((asset) => asset.stepId === null);
    const stepLevel = all.filter((asset) => asset.stepId === step.id);

    assert.deepEqual(
      definitionImages(processLevel).map((asset) => asset.kind),
      ['image'],
    );
    assert.deepEqual(
      definitionAudio(processLevel).map((asset) => [asset.id, asset.caption]),
      [[processAudio.id, 'Overview']],
    );
    assert.deepEqual(definitionImages(stepLevel), []);
    assert.deepEqual(
      definitionAudio(stepLevel).map((asset) => asset.id),
      [stepAudio.id],
    );

    const captioned = await media.updateMedia(stepAudio.id, { caption: 'Detail' });
    assert.equal(captioned.caption, 'Detail');
    assert.equal(captioned.isCover, false);

    await media.softDelete(processAudio.id);
    const after = await media.listForProcess(process.id);
    assert.deepEqual(
      definitionAudio(after).map((asset) => asset.id),
      [stepAudio.id],
    );
    assert.equal(definitionImages(after).length, 1);
  });

  it('keeps audio out of image strip helpers used by the editor', () => {
    const mixed: MediaAsset[] = [
      {
        id: 'img_1',
        ownerId: owner,
        createdBy: owner,
        updatedBy: owner,
        processId: 'p1',
        stepId: null,
        kind: 'image',
        storagePath: 'file:///a.jpg',
        contentType: 'image/jpeg',
        byteSize: 1,
        caption: '',
        position: 'a',
        isCover: true,
        deletedAt: null,
        createdAt: '2026-10-02T00:00:00.000Z',
        updatedAt: '2026-10-02T00:00:00.000Z',
      },
      {
        id: 'aud_1',
        ownerId: owner,
        createdBy: owner,
        updatedBy: owner,
        processId: 'p1',
        stepId: null,
        kind: 'audio',
        storagePath: 'file:///a.m4a',
        contentType: 'audio/mp4',
        byteSize: 2,
        caption: 'Note',
        position: 'b',
        isCover: false,
        deletedAt: null,
        createdAt: '2026-10-02T00:00:00.000Z',
        updatedAt: '2026-10-02T00:00:00.000Z',
      },
    ];

    assert.deepEqual(
      definitionImages(mixed).map((asset) => asset.id),
      ['img_1'],
    );
    assert.deepEqual(
      definitionAudio(mixed).map((asset) => asset.id),
      ['aud_1'],
    );
  });
});
