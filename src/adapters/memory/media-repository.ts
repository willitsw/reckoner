import { rankBetween } from '@/src/domain/rank';
import type { MediaAsset, MediaId, Process, ProcessId, Step, StepId } from '@/src/domain/types';
import type {
  AttachImageInput,
  MediaRepository,
  UpdateMediaPatch,
} from '@/src/ports/media-repository';

function nowIso() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Code-point order. Fractional ranks are not locale strings. */
function compareRank(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareSiblings(a: MediaAsset, b: MediaAsset) {
  return compareRank(a.position, b.position) || compareRank(a.id, b.id);
}

export type MemoryMediaDeps = {
  getProcess: (processId: ProcessId) => Process | undefined;
  getStep: (stepId: StepId) => Step | undefined;
  /** Live steps for a process, already ordered by position. */
  listLiveSteps: (processId: ProcessId) => Step[];
};

/**
 * In-memory definition media. Shares process/step identity with the memory library.
 */
export function createMemoryMediaRepository(deps: MemoryMediaDeps): MediaRepository {
  const media = new Map<MediaId, MediaAsset>();

  function requireMedia(mediaId: MediaId) {
    const existing = media.get(mediaId);
    if (!existing) throw new Error(`Media not found: ${mediaId}`);
    return existing;
  }

  function siblings(processId: ProcessId, stepId: StepId | null) {
    return [...media.values()].filter(
      (asset) =>
        asset.processId === processId &&
        asset.stepId === stepId &&
        asset.deletedAt === null,
    );
  }

  function nextPosition(processId: ProcessId, stepId: StepId | null, explicit?: string) {
    if (explicit !== undefined) return explicit;
    const last = siblings(processId, stepId)
      .map((asset) => asset.position)
      .sort(compareRank)
      .at(-1) ?? null;
    return rankBetween(last, null);
  }

  /** One cover image per process: latest write wins. */
  function clearOtherCovers(processId: ProcessId, keepId: MediaId, timestamp: string) {
    for (const asset of media.values()) {
      if (asset.processId !== processId || asset.id === keepId || !asset.isCover) continue;
      media.set(asset.id, {
        ...asset,
        isCover: false,
        updatedBy: asset.ownerId,
        updatedAt: timestamp,
      });
    }
  }

  return {
    async listForProcess(processId) {
      const assets = [...media.values()].filter(
        (asset) => asset.processId === processId && asset.deletedAt === null,
      );
      const stepOrder = deps.listLiveSteps(processId).map((step) => step.id);
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
      return siblings(processId, stepId).sort(compareSiblings);
    },

    async attachImage(input: AttachImageInput) {
      const process = deps.getProcess(input.processId);
      if (!process) throw new Error(`Process not found: ${input.processId}`);
      if (process.deletedAt) throw new Error('A deleted process cannot take new media.');

      const stepId = input.stepId ?? null;
      if (stepId !== null) {
        const step = deps.getStep(stepId);
        if (!step || step.deletedAt) throw new Error(`Step not found: ${stepId}`);
        if (step.processId !== input.processId) {
          throw new Error('That step does not belong to this process.');
        }
      }

      if (!input.storagePath) throw new Error('storagePath is required.');
      if (input.byteSize != null && input.byteSize < 0) {
        throw new Error('byteSize cannot be negative.');
      }

      const isCover = input.isCover ?? false;
      const timestamp = nowIso();
      const asset: MediaAsset = {
        id: id('media'),
        ownerId: process.ownerId,
        createdBy: process.ownerId,
        updatedBy: process.ownerId,
        processId: input.processId,
        stepId,
        kind: 'image',
        storagePath: input.storagePath,
        contentType: input.contentType ?? null,
        byteSize: input.byteSize ?? null,
        caption: input.caption ?? '',
        position: nextPosition(input.processId, stepId, input.position),
        isCover,
        deletedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      media.set(asset.id, asset);
      if (isCover) clearOtherCovers(input.processId, asset.id, timestamp);
      return asset;
    },

    async updateMedia(mediaId, patch: UpdateMediaPatch) {
      const existing = requireMedia(mediaId);
      if (existing.deletedAt) throw new Error('Deleted media cannot be updated.');
      if (patch.isCover === true && existing.kind !== 'image') {
        throw new Error('Only an image can be cover.');
      }

      const timestamp = nowIso();
      const updated: MediaAsset = {
        ...existing,
        ...patch,
        updatedBy: existing.ownerId,
        updatedAt: timestamp,
      };
      media.set(mediaId, updated);
      if (patch.isCover === true) clearOtherCovers(existing.processId, mediaId, timestamp);
      return updated;
    },

    async softDelete(mediaId) {
      const existing = media.get(mediaId);
      if (!existing || existing.deletedAt) return;
      media.set(mediaId, {
        ...existing,
        deletedAt: nowIso(),
        updatedBy: existing.ownerId,
        updatedAt: nowIso(),
      });
    },

    async clearLocal() {
      media.clear();
    },
  };
}
