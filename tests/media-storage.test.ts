import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createMemoryLibrary } from '../src/adapters/memory/process-repository';
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

describe('Supabase Storage media adapter', () => {
  it('uploads to {owner_id}/{id} then inserts the media row', async () => {
    const { processes } = createMemoryLibrary();
    const storage = createFakeStorage();
    const rows = createFakeMediaAssetsStore();
    const mediaId = '11111111-1111-4111-8111-111111111111';
    const localBytes = new TextEncoder().encode('fake-jpeg');

    const media = createSupabaseMediaRepository({
      storage,
      rows,
      processes,
      readLocalFile: async (localPath) => {
        assert.equal(localPath, 'file:///local/cover.jpg');
        return { body: localBytes, contentType: 'image/jpeg' };
      },
      createId: () => mediaId,
      now: () => '2026-10-02T12:00:00.000Z',
    });

    const process = await processes.createProcess({ ownerId: owner, title: 'Pack kit' });
    const asset = await media.attachImage({
      processId: process.id,
      storagePath: 'file:///local/cover.jpg',
      caption: 'Kit overview',
      isCover: true,
      byteSize: localBytes.byteLength,
    });

    const expectedPath = `${owner}/${mediaId}`;
    assert.equal(asset.id, mediaId);
    assert.equal(asset.storagePath, expectedPath);
    assert.equal(asset.ownerId, owner);
    assert.equal(asset.kind, 'image');
    assert.equal(asset.isCover, true);
    assert.equal(asset.contentType, 'image/jpeg');

    const uploaded = storage.objects.get(expectedPath);
    assert.ok(uploaded);
    assert.deepEqual(uploaded.body, localBytes);
    assert.equal(uploaded.contentType, 'image/jpeg');
    assert.equal(rows.rows.size, 1);
    assert.equal(rows.rows.get(mediaId)?.storagePath, expectedPath);
  });

  it('leaves no media row when storage upload fails', async () => {
    const { processes } = createMemoryLibrary();
    const storage = createFakeStorage();
    const rows = createFakeMediaAssetsStore();
    storage.failNextUpload = new Error('storage unavailable');

    const media = createSupabaseMediaRepository({
      storage,
      rows,
      processes,
      readLocalFile: async () => ({
        body: new TextEncoder().encode('x'),
        contentType: 'image/png',
      }),
      createId: () => '22222222-2222-4222-8222-222222222222',
    });

    const process = await processes.createProcess({ ownerId: owner, title: 'Glaze' });
    await assert.rejects(
      () =>
        media.attachImage({
          processId: process.id,
          storagePath: 'file:///local/fail.png',
        }),
      /storage unavailable/,
    );

    assert.equal(storage.objects.size, 0);
    assert.equal(rows.rows.size, 0);
    assert.deepEqual(await media.listForProcess(process.id), []);
  });

  it('soft-deletes the row without removing the storage object', async () => {
    const { processes } = createMemoryLibrary();
    const storage = createFakeStorage();
    const rows = createFakeMediaAssetsStore();
    const mediaId = '33333333-3333-4333-8333-333333333333';

    const media = createSupabaseMediaRepository({
      storage,
      rows,
      processes,
      readLocalFile: async () => ({
        body: new TextEncoder().encode('img'),
        contentType: 'image/jpeg',
      }),
      createId: () => mediaId,
      now: () => '2026-10-02T15:00:00.000Z',
    });

    const process = await processes.createProcess({ ownerId: owner, title: 'Soft delete' });
    await media.attachImage({
      processId: process.id,
      storagePath: 'file:///local/keep.jpg',
    });

    const objectPath = `${owner}/${mediaId}`;
    assert.ok(storage.objects.has(objectPath));

    await media.softDelete(mediaId);

    assert.ok(storage.objects.has(objectPath), 'storage object remains until a later purge');
    assert.equal(rows.rows.get(mediaId)?.deletedAt, '2026-10-02T15:00:00.000Z');
    assert.deepEqual(await media.listForProcess(process.id), []);
  });
});
