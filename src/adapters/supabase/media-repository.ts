import type { SupabaseClient } from '@supabase/supabase-js';

import { rankBetween } from '@/src/domain/rank';
import type { MediaAsset, MediaId, ProcessId, StepId } from '@/src/domain/types';
import type {
  AttachAudioInput,
  AttachImageInput,
  MediaRepository,
  UpdateMediaPatch,
} from '@/src/ports/media-repository';
import type { ProcessRepository } from '@/src/ports/process-repository';

/** Private how-to media bucket. Path convention `{owner_id}/{id}`. */
export const MEDIA_BUCKET = 'media';

export function mediaObjectPath(ownerId: string, mediaId: string): string {
  return `${ownerId}/${mediaId}`;
}

/** Narrow Storage upload surface. Feature modules never import this. */
export type MediaStorageClient = {
  upload(input: {
    bucket: string;
    path: string;
    body: Uint8Array;
    contentType?: string | null;
  }): Promise<void>;
};

/** Persist `media_assets` rows after a successful upload. */
export type MediaAssetsStore = {
  insert(asset: MediaAsset): Promise<MediaAsset>;
  findById(id: MediaId): Promise<MediaAsset | null>;
  listForProcess(processId: ProcessId): Promise<MediaAsset[]>;
  listForStep(processId: ProcessId, stepId: StepId | null): Promise<MediaAsset[]>;
  update(id: MediaId, patch: Partial<MediaAsset>): Promise<MediaAsset>;
};

export type ReadLocalFileResult = {
  body: Uint8Array;
  contentType?: string | null;
};

export type SupabaseMediaRepositoryDeps = {
  storage: MediaStorageClient;
  rows: MediaAssetsStore;
  processes: ProcessRepository;
  readLocalFile: (localPath: string) => Promise<ReadLocalFileResult>;
  createId?: () => string;
  now?: () => string;
};

/** Code-point order. Fractional ranks are not locale strings. */
function compareRank(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareSiblings(a: MediaAsset, b: MediaAsset) {
  return compareRank(a.position, b.position) || compareRank(a.id, b.id);
}

function defaultId() {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

/**
 * MediaRepository that uploads to the private `media` bucket at
 * `{owner_id}/{id}`, then inserts the `media_assets` row. Soft-delete only
 * sets `deleted_at`; storage purge can lag.
 */
export function createSupabaseMediaRepository(deps: SupabaseMediaRepositoryDeps): MediaRepository {
  const createId = deps.createId ?? defaultId;
  const now = deps.now ?? nowIso;

  async function requireMedia(mediaId: MediaId) {
    const existing = await deps.rows.findById(mediaId);
    if (!existing) throw new Error(`Media not found: ${mediaId}`);
    return existing;
  }

  async function nextPosition(processId: ProcessId, stepId: StepId | null, explicit?: string) {
    if (explicit !== undefined) return explicit;
    const siblings = await deps.rows.listForStep(processId, stepId);
    const last = siblings
      .map((asset) => asset.position)
      .sort(compareRank)
      .at(-1) ?? null;
    return rankBetween(last, null);
  }

  return {
    async listForProcess(processId) {
      const assets = await deps.rows.listForProcess(processId);
      const stepOrder = (await deps.processes.listSteps(processId)).map((step) => step.id);
      const stepIndex = new Map(stepOrder.map((stepId, index) => [stepId, index]));

      return assets.sort((a, b) => {
        const aGroup =
          a.stepId === null ? -1 : (stepIndex.get(a.stepId) ?? Number.MAX_SAFE_INTEGER);
        const bGroup =
          b.stepId === null ? -1 : (stepIndex.get(b.stepId) ?? Number.MAX_SAFE_INTEGER);
        if (aGroup !== bGroup) return aGroup - bGroup;
        if (aGroup === Number.MAX_SAFE_INTEGER && a.stepId !== b.stepId) {
          return (a.stepId ?? '').localeCompare(b.stepId ?? '');
        }
        return compareSiblings(a, b);
      });
    },

    async listForStep(processId, stepId) {
      const assets = await deps.rows.listForStep(processId, stepId);
      return assets.sort(compareSiblings);
    },

    async attachImage(input: AttachImageInput) {
      const process = await deps.processes.getProcess(input.processId);
      if (!process) throw new Error(`Process not found: ${input.processId}`);
      if (process.deletedAt) throw new Error('A deleted process cannot take new media.');

      const stepId = input.stepId ?? null;
      if (stepId !== null) {
        const steps = await deps.processes.listSteps(input.processId);
        const step = steps.find((row) => row.id === stepId);
        if (!step || step.deletedAt) throw new Error(`Step not found: ${stepId}`);
        if (step.processId !== input.processId) {
          throw new Error('That step does not belong to this process.');
        }
      }

      if (!input.storagePath) throw new Error('storagePath is required.');
      if (input.byteSize != null && input.byteSize < 0) {
        throw new Error('byteSize cannot be negative.');
      }

      const mediaId = createId() as MediaId;
      const objectPath = mediaObjectPath(process.ownerId, mediaId);
      const local = await deps.readLocalFile(input.storagePath);
      const contentType = input.contentType ?? local.contentType ?? null;

      await deps.storage.upload({
        bucket: MEDIA_BUCKET,
        path: objectPath,
        body: local.body,
        contentType,
      });

      const timestamp = now();
      const asset: MediaAsset = {
        id: mediaId,
        ownerId: process.ownerId,
        createdBy: process.ownerId,
        updatedBy: process.ownerId,
        processId: input.processId,
        stepId,
        kind: 'image',
        storagePath: objectPath,
        contentType,
        byteSize: input.byteSize ?? local.body.byteLength,
        caption: input.caption ?? '',
        position: await nextPosition(input.processId, stepId, input.position),
        isCover: input.isCover ?? false,
        deletedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      return deps.rows.insert(asset);
    },

    async attachAudio(input: AttachAudioInput) {
      if ('isCover' in input && (input as { isCover?: boolean }).isCover === true) {
        throw new Error('Only an image can be cover.');
      }

      const process = await deps.processes.getProcess(input.processId);
      if (!process) throw new Error(`Process not found: ${input.processId}`);
      if (process.deletedAt) throw new Error('A deleted process cannot take new media.');

      const stepId = input.stepId ?? null;
      if (stepId !== null) {
        const steps = await deps.processes.listSteps(input.processId);
        const step = steps.find((row) => row.id === stepId);
        if (!step || step.deletedAt) throw new Error(`Step not found: ${stepId}`);
        if (step.processId !== input.processId) {
          throw new Error('That step does not belong to this process.');
        }
      }

      if (!input.storagePath) throw new Error('storagePath is required.');
      if (input.byteSize != null && input.byteSize < 0) {
        throw new Error('byteSize cannot be negative.');
      }

      const mediaId = createId() as MediaId;
      const objectPath = mediaObjectPath(process.ownerId, mediaId);
      const local = await deps.readLocalFile(input.storagePath);
      const contentType = input.contentType ?? local.contentType ?? null;

      await deps.storage.upload({
        bucket: MEDIA_BUCKET,
        path: objectPath,
        body: local.body,
        contentType,
      });

      const timestamp = now();
      const asset: MediaAsset = {
        id: mediaId,
        ownerId: process.ownerId,
        createdBy: process.ownerId,
        updatedBy: process.ownerId,
        processId: input.processId,
        stepId,
        kind: 'audio',
        storagePath: objectPath,
        contentType,
        byteSize: input.byteSize ?? local.body.byteLength,
        caption: input.caption ?? '',
        position: await nextPosition(input.processId, stepId, input.position),
        isCover: false,
        deletedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      return deps.rows.insert(asset);
    },

    async updateMedia(mediaId, patch: UpdateMediaPatch) {
      const existing = await requireMedia(mediaId);
      if (existing.deletedAt) throw new Error('Deleted media cannot be updated.');
      if (patch.isCover === true && existing.kind !== 'image') {
        throw new Error('Only an image can be cover.');
      }

      return deps.rows.update(mediaId, {
        ...patch,
        updatedBy: existing.ownerId,
        updatedAt: now(),
      });
    },

    async softDelete(mediaId) {
      const existing = await deps.rows.findById(mediaId);
      if (!existing || existing.deletedAt) return;
      await deps.rows.update(mediaId, {
        deletedAt: now(),
        updatedBy: existing.ownerId,
        updatedAt: now(),
      });
    },

    async clearLocal() {
      // Device wipe is owned by the local/PowerSync layer. Online Storage
      // objects are removed by delete_own_account / a later purge job.
    },
  };
}

/** Supabase Storage adapter for the private `media` bucket. */
export function createSupabaseMediaStorageClient(client: SupabaseClient): MediaStorageClient {
  return {
    async upload({ bucket, path, body, contentType }) {
      const { error } = await client.storage.from(bucket).upload(path, body, {
        contentType: contentType ?? undefined,
        upsert: false,
      });
      if (error) throw error;
    },
  };
}

type MediaAssetRow = {
  id: string;
  owner_id: string;
  created_by: string | null;
  updated_by: string | null;
  process_id: string;
  step_id: string | null;
  kind: 'image' | 'audio';
  storage_path: string;
  content_type: string | null;
  byte_size: number | null;
  caption: string;
  position: string;
  is_cover: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

function fromRow(row: MediaAssetRow): MediaAsset {
  return {
    id: row.id,
    ownerId: row.owner_id,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    processId: row.process_id,
    stepId: row.step_id,
    kind: row.kind,
    storagePath: row.storage_path,
    contentType: row.content_type,
    byteSize: row.byte_size,
    caption: row.caption,
    position: row.position,
    isCover: row.is_cover,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toInsertRow(asset: MediaAsset): Omit<MediaAssetRow, never> {
  return {
    id: asset.id,
    owner_id: asset.ownerId,
    created_by: asset.createdBy,
    updated_by: asset.updatedBy,
    process_id: asset.processId,
    step_id: asset.stepId,
    kind: asset.kind,
    storage_path: asset.storagePath,
    content_type: asset.contentType,
    byte_size: asset.byteSize,
    caption: asset.caption,
    position: asset.position,
    is_cover: asset.isCover,
    deleted_at: asset.deletedAt,
    created_at: asset.createdAt,
    updated_at: asset.updatedAt,
  };
}

/** Direct Supabase `media_assets` table access for the online path. */
export function createSupabaseMediaAssetsStore(client: SupabaseClient): MediaAssetsStore {
  return {
    async insert(asset) {
      const { data, error } = await client
        .from('media_assets')
        .insert(toInsertRow(asset))
        .select('*')
        .single();
      if (error) throw error;
      return fromRow(data as MediaAssetRow);
    },

    async findById(id) {
      const { data, error } = await client.from('media_assets').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data ? fromRow(data as MediaAssetRow) : null;
    },

    async listForProcess(processId) {
      const { data, error } = await client
        .from('media_assets')
        .select('*')
        .eq('process_id', processId)
        .is('deleted_at', null);
      if (error) throw error;
      return ((data ?? []) as MediaAssetRow[]).map(fromRow);
    },

    async listForStep(processId, stepId) {
      let query = client
        .from('media_assets')
        .select('*')
        .eq('process_id', processId)
        .is('deleted_at', null);
      query = stepId === null ? query.is('step_id', null) : query.eq('step_id', stepId);
      const { data, error } = await query;
      if (error) throw error;
      return ((data ?? []) as MediaAssetRow[]).map(fromRow);
    },

    async update(id, patch) {
      const rowPatch: Partial<MediaAssetRow> = {};
      if (patch.caption !== undefined) rowPatch.caption = patch.caption;
      if (patch.position !== undefined) rowPatch.position = patch.position;
      if (patch.isCover !== undefined) rowPatch.is_cover = patch.isCover;
      if (patch.deletedAt !== undefined) rowPatch.deleted_at = patch.deletedAt;
      if (patch.updatedBy !== undefined) rowPatch.updated_by = patch.updatedBy;
      if (patch.updatedAt !== undefined) rowPatch.updated_at = patch.updatedAt;
      if (patch.contentType !== undefined) rowPatch.content_type = patch.contentType;
      if (patch.byteSize !== undefined) rowPatch.byte_size = patch.byteSize;
      if (patch.storagePath !== undefined) rowPatch.storage_path = patch.storagePath;

      const { data, error } = await client
        .from('media_assets')
        .update(rowPatch)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return fromRow(data as MediaAssetRow);
    },
  };
}

/**
 * Wire Storage + `media_assets` for the online path. Callers still pass a
 * ProcessRepository. The device-local upload queue drains through
 * `attachImage` (upload then row); pending jobs never live in this store.
 */
export function createSupabaseStorageMediaRepository(
  client: SupabaseClient,
  deps: Omit<SupabaseMediaRepositoryDeps, 'storage' | 'rows'> & {
    storage?: MediaStorageClient;
    rows?: MediaAssetsStore;
  },
): MediaRepository {
  return createSupabaseMediaRepository({
    storage: deps.storage ?? createSupabaseMediaStorageClient(client),
    rows: deps.rows ?? createSupabaseMediaAssetsStore(client),
    processes: deps.processes,
    readLocalFile: deps.readLocalFile,
    createId: deps.createId,
    now: deps.now,
  });
}

/** Default local-file reader for Expo / web (`file://`, `blob:`, https). */
export async function readLocalMediaFile(localPath: string): Promise<ReadLocalFileResult> {
  const response = await fetch(localPath);
  if (!response.ok) {
    throw new Error('Could not read the captured image.');
  }
  const contentType = response.headers.get('content-type');
  return {
    body: new Uint8Array(await response.arrayBuffer()),
    contentType,
  };
}
