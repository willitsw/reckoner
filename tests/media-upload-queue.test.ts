import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createMemoryLibrary } from '../src/adapters/memory/process-repository';
import { createMemoryMediaUploadQueue } from '../src/adapters/memory/media-upload-queue';
import {
  MEDIA_BUCKET,
  createSupabaseMediaRepository,
  type MediaAssetsStore,
  type MediaStorageClient,
} from '../src/adapters/supabase/media-repository';
import type { MediaAsset, MediaId, ProcessId, StepId } from '../src/domain/types';

const owner = 'user_1';

type FakeStorage = MediaStorageClient & {
  objects: Map<string, { body: Uint8Array; contentType?: string | null }>;
  failNextUpload: Error | null;
};

function createFakeStorage(): FakeStorage {
  const objects = new Map<string, { body: Uint8Array; contentType?: string | null }>();
  let failNextUpload: Error | null = null;

  return {
    objects,
    get failNextUpload() {
      return failNextUpload;
    },
    set failNextUpload(error: Error | null) {
      failNextUpload = error;
    },
    async upload({ bucket, path, body, contentType }) {
      assert.equal(bucket, MEDIA_BUCKET);
      if (failNextUpload) {
        const error = failNextUpload;
        failNextUpload = null;
        throw error;
      }
      objects.set(path, { body, contentType: contentType ?? null });
    },
  };
}

function createFakeMediaAssetsStore(): MediaAssetsStore & { rows: Map<MediaId, MediaAsset> } {
  const rows = new Map<MediaId, MediaAsset>();

  return {
    rows,
    async insert(asset) {
      if (rows.has(asset.id)) throw new Error(`Media already exists: ${asset.id}`);
      rows.set(asset.id, asset);
      return asset;
    },
    async findById(id) {
      return rows.get(id) ?? null;
    },
    async listForProcess(processId: ProcessId) {
      return [...rows.values()].filter(
        (asset) => asset.processId === processId && asset.deletedAt === null,
      );
    },
    async listForStep(processId: ProcessId, stepId: StepId | null) {
      return [...rows.values()].filter(
        (asset) =>
          asset.processId === processId &&
          asset.stepId === stepId &&
          asset.deletedAt === null,
      );
    },
    async update(id, patch) {
      const existing = rows.get(id);
      if (!existing) throw new Error(`Media not found: ${id}`);
      const updated = { ...existing, ...patch };
      rows.set(id, updated);
      return updated;
    },
  };
}

type Harness = {
  processes: ReturnType<typeof createMemoryLibrary>['processes'];
  media: ReturnType<typeof createSupabaseMediaRepository>;
  storage: FakeStorage;
  rows: ReturnType<typeof createFakeMediaAssetsStore>;
  queue: ReturnType<typeof createMemoryMediaUploadQueue>;
  setOnline: (online: boolean) => void;
  advanceMs: (ms: number) => void;
};

function createHarness(options?: { mediaId?: string }): Harness {
  const { processes } = createMemoryLibrary();
  const storage = createFakeStorage();
  const rows = createFakeMediaAssetsStore();
  const mediaId = options?.mediaId ?? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  let online = true;
  let nowMs = Date.parse('2026-10-02T12:00:00.000Z');

  const media = createSupabaseMediaRepository({
    storage,
    rows,
    processes,
    readLocalFile: async (localPath) => ({
      body: new TextEncoder().encode(`bytes:${localPath}`),
      contentType: 'image/jpeg',
    }),
    createId: () => mediaId,
    now: () => new Date(nowMs).toISOString(),
  });

  const queue = createMemoryMediaUploadQueue({
    media,
    isOnline: () => online,
    now: () => new Date(nowMs).toISOString(),
    createId: () => 'job_1',
    backoffMs: (attempt) => 1000 * 2 ** (attempt - 1),
  });

  return {
    processes,
    media,
    storage,
    rows,
    queue,
    setOnline: (value) => {
      online = value;
    },
    advanceMs: (ms) => {
      nowMs += ms;
    },
  };
}

describe('offline media upload queue', () => {
  it('enqueues while offline without uploading or attaching a media row', async () => {
    const harness = createHarness();
    harness.setOnline(false);
    const process = await harness.processes.createProcess({ ownerId: owner, title: 'Pack kit' });

    const pending = await harness.queue.enqueue({
      processId: process.id,
      storagePath: 'file:///local/cover.jpg',
      caption: 'Kit overview',
      isCover: true,
    });

    assert.equal(pending.processId, process.id);
    assert.equal(pending.localPath, 'file:///local/cover.jpg');
    assert.equal(pending.caption, 'Kit overview');
    assert.equal(pending.isCover, true);
    assert.equal(pending.attempts, 0);
    assert.equal(pending.lastError, null);

    const listed = await harness.queue.listPending();
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.id, pending.id);

    assert.equal(harness.storage.objects.size, 0);
    assert.equal(harness.rows.rows.size, 0);
    assert.deepEqual(await harness.media.listForProcess(process.id), []);
  });

  it('drains when online: uploads then attaches the media row', async () => {
    const mediaId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const harness = createHarness({ mediaId });
    harness.setOnline(false);
    const process = await harness.processes.createProcess({ ownerId: owner, title: 'Glaze' });

    await harness.queue.enqueue({
      processId: process.id,
      storagePath: 'file:///local/glaze.jpg',
      caption: 'After dip',
    });

    harness.setOnline(true);
    const result = await harness.queue.drain();

    assert.equal(result.uploaded, 1);
    assert.equal(result.failed, 0);
    assert.equal(result.deferred, 0);
    assert.deepEqual(await harness.queue.listPending(), []);

    const expectedPath = `${owner}/${mediaId}`;
    assert.ok(harness.storage.objects.has(expectedPath));
    assert.equal(harness.rows.rows.size, 1);

    const assets = await harness.media.listForProcess(process.id);
    assert.equal(assets.length, 1);
    assert.equal(assets[0]?.storagePath, expectedPath);
    assert.equal(assets[0]?.caption, 'After dip');
    assert.notEqual(assets[0]?.storagePath, 'file:///local/glaze.jpg');
  });

  it('retries failed uploads after backoff using a fake clock', async () => {
    const harness = createHarness();
    harness.setOnline(true);
    const process = await harness.processes.createProcess({ ownerId: owner, title: 'Retry' });

    await harness.queue.enqueue({
      processId: process.id,
      storagePath: 'file:///local/retry.jpg',
    });

    harness.storage.failNextUpload = new Error('storage unavailable');
    const first = await harness.queue.drain();
    assert.equal(first.uploaded, 0);
    assert.equal(first.failed, 1);
    assert.equal(first.deferred, 0);

    const afterFail = await harness.queue.listPending();
    assert.equal(afterFail.length, 1);
    assert.equal(afterFail[0]?.attempts, 1);
    assert.match(afterFail[0]?.lastError ?? '', /storage unavailable/);
    assert.equal(afterFail[0]?.nextAttemptAt, '2026-10-02T12:00:01.000Z');
    assert.equal(harness.rows.rows.size, 0);

    // Still within backoff — drain defers.
    harness.advanceMs(500);
    const deferred = await harness.queue.drain();
    assert.equal(deferred.uploaded, 0);
    assert.equal(deferred.failed, 0);
    assert.equal(deferred.deferred, 1);
    assert.equal(harness.storage.objects.size, 0);

    // Past backoff — retry succeeds.
    harness.advanceMs(500);
    const second = await harness.queue.drain();
    assert.equal(second.uploaded, 1);
    assert.equal(second.failed, 0);
    assert.deepEqual(await harness.queue.listPending(), []);
    assert.equal(harness.rows.rows.size, 1);
    assert.equal((await harness.media.listForProcess(process.id)).length, 1);
  });

  it('wipe clears pending jobs without touching already-uploaded media', async () => {
    const harness = createHarness();
    harness.setOnline(false);
    const process = await harness.processes.createProcess({ ownerId: owner, title: 'Wipe' });

    await harness.queue.enqueue({
      processId: process.id,
      storagePath: 'file:///local/pending.jpg',
    });
    assert.equal((await harness.queue.listPending()).length, 1);

    await harness.queue.clearLocal();
    assert.deepEqual(await harness.queue.listPending(), []);
    assert.equal(harness.rows.rows.size, 0);
  });

  it('does not put pending uploads in synced media rows', async () => {
    const harness = createHarness();
    harness.setOnline(false);
    const process = await harness.processes.createProcess({ ownerId: owner, title: 'No sync' });
    const step = await harness.processes.createStep({
      processId: process.id,
      body: 'Capture offline',
    });

    await harness.queue.enqueue({
      processId: process.id,
      stepId: step.id,
      storagePath: 'file:///local/offline.png',
      caption: 'Pending only',
    });

    // Synced Postgres / PowerSync surface is the media row store — still empty.
    assert.equal(harness.rows.rows.size, 0);
    assert.deepEqual(await harness.media.listForProcess(process.id), []);
    assert.deepEqual(await harness.media.listForStep(process.id, step.id), []);

    const pending = await harness.queue.listPending();
    assert.equal(pending.length, 1);
    assert.equal(pending[0]?.stepId, step.id);
    assert.equal(pending[0]?.localPath, 'file:///local/offline.png');
  });

  it('drain while offline leaves jobs pending', async () => {
    const harness = createHarness();
    harness.setOnline(false);
    const process = await harness.processes.createProcess({ ownerId: owner, title: 'Stay local' });

    await harness.queue.enqueue({
      processId: process.id,
      storagePath: 'file:///local/wait.jpg',
    });

    const result = await harness.queue.drain();
    assert.equal(result.uploaded, 0);
    assert.equal(result.failed, 0);
    assert.equal(result.deferred, 1);
    assert.equal((await harness.queue.listPending()).length, 1);
    assert.equal(harness.storage.objects.size, 0);
    assert.equal(harness.rows.rows.size, 0);
  });
});
