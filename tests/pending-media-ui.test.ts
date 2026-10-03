import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createMemoryLibrary } from '../src/adapters/memory/process-repository';
import { createMemoryMediaUploadQueue } from '../src/adapters/memory/media-upload-queue';
import { filterPendingMediaForTarget } from '../src/modules/process/filter-pending-media';
import type { PendingMediaUpload } from '../src/ports/media-upload-queue';

const owner = 'user_1';

function pending(
  partial: Partial<PendingMediaUpload> &
    Pick<PendingMediaUpload, 'id' | 'processId' | 'localPath'>,
): PendingMediaUpload {
  return {
    stepId: null,
    contentType: 'image/jpeg',
    byteSize: 12,
    caption: '',
    isCover: false,
    attempts: 0,
    nextAttemptAt: '2026-10-02T12:00:00.000Z',
    lastError: null,
    createdAt: '2026-10-02T12:00:00.000Z',
    ...partial,
  };
}

describe('filterPendingMediaForTarget', () => {
  it('keeps only pending jobs for the process-level strip', () => {
    const jobs = [
      pending({ id: 'j1', processId: 'p1', localPath: 'file:///a.jpg' }),
      pending({ id: 'j2', processId: 'p1', stepId: 's1', localPath: 'file:///b.jpg' }),
      pending({ id: 'j3', processId: 'p2', localPath: 'file:///c.jpg' }),
    ];

    const filtered = filterPendingMediaForTarget(jobs, 'p1', null);
    assert.deepEqual(
      filtered.map((job) => job.id),
      ['j1'],
    );
  });

  it('keeps only pending jobs for a step strip', () => {
    const jobs = [
      pending({ id: 'j1', processId: 'p1', localPath: 'file:///a.jpg' }),
      pending({ id: 'j2', processId: 'p1', stepId: 's1', localPath: 'file:///b.jpg' }),
      pending({ id: 'j3', processId: 'p1', stepId: 's2', localPath: 'file:///c.jpg' }),
    ];

    const filtered = filterPendingMediaForTarget(jobs, 'p1', 's1');
    assert.deepEqual(
      filtered.map((job) => job.id),
      ['j2'],
    );
  });

  it('returns an empty list when nothing matches', () => {
    assert.deepEqual(filterPendingMediaForTarget([], 'p1', null), []);
    assert.deepEqual(
      filterPendingMediaForTarget(
        [pending({ id: 'j1', processId: 'p1', stepId: 's1', localPath: 'file:///a.jpg' })],
        'p1',
        null,
      ),
      [],
    );
  });
});

describe('pending vs uploaded media via upload queue', () => {
  it('lists pending while offline and moves to uploaded media after drain', async () => {
    const { processes, media } = createMemoryLibrary();
    let online = false;
    const queue = createMemoryMediaUploadQueue({
      media,
      isOnline: () => online,
      now: () => '2026-10-02T12:00:00.000Z',
      createId: () => 'job_pending_1',
    });

    const process = await processes.createProcess({ ownerId: owner, title: 'Trail kit' });
    const step = await processes.createStep({ processId: process.id, body: 'Pack stove' });

    await queue.enqueue({
      processId: process.id,
      stepId: step.id,
      storagePath: 'file:///local/stove.jpg',
      caption: 'Packed',
    });

    const listed = await queue.listPending();
    const stripPending = filterPendingMediaForTarget(listed, process.id, step.id);
    assert.equal(stripPending.length, 1);
    assert.equal(stripPending[0]?.localPath, 'file:///local/stove.jpg');
    assert.deepEqual(await media.listForStep(process.id, step.id), []);

    online = true;
    const result = await queue.drain();
    assert.equal(result.uploaded, 1);
    assert.deepEqual(filterPendingMediaForTarget(await queue.listPending(), process.id, step.id), []);

    const uploaded = await media.listForStep(process.id, step.id);
    assert.equal(uploaded.length, 1);
    assert.equal(uploaded[0]?.caption, 'Packed');
    assert.equal(uploaded[0]?.storagePath, 'file:///local/stove.jpg');
  });

  it('drain while offline does not throw and leaves the job pending', async () => {
    const { processes, media } = createMemoryLibrary();
    const queue = createMemoryMediaUploadQueue({
      media,
      isOnline: () => false,
      createId: () => 'job_offline',
    });
    const process = await processes.createProcess({ ownerId: owner, title: 'Offline snap' });

    await queue.enqueue({
      processId: process.id,
      storagePath: 'file:///local/offline.jpg',
    });

    const result = await queue.drain();
    assert.equal(result.deferred, 1);
    assert.equal(result.uploaded, 0);
    assert.equal((await queue.listPending()).length, 1);
    assert.deepEqual(await media.listForProcess(process.id), []);
  });
});
