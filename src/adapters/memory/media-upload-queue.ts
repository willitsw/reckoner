import type { AttachImageInput, MediaRepository } from '@/src/ports/media-repository';
import type {
  MediaUploadDrainResult,
  MediaUploadQueue,
  PendingMediaUpload,
} from '@/src/ports/media-upload-queue';

export type MemoryMediaUploadQueueDeps = {
  /** Upload path: Storage then media_assets row (online adapter) or memory. */
  media: MediaRepository;
  isOnline: () => boolean;
  /** ISO timestamp clock. Inject a fake for backoff tests. */
  now?: () => string;
  createId?: () => string;
  /** Delay before the next attempt after `attempt` failures (1-based). */
  backoffMs?: (attempt: number) => number;
};

function defaultId() {
  return `upload_${Math.random().toString(36).slice(2, 10)}`;
}

function defaultNow() {
  return new Date().toISOString();
}

function defaultBackoffMs(attempt: number) {
  return Math.min(1_000 * 2 ** Math.max(0, attempt - 1), 60_000);
}

/**
 * In-memory device-local upload queue. Default for unit/CI; never syncs
 * pending jobs — only MediaRepository.attachImage writes durable rows.
 */
export function createMemoryMediaUploadQueue(deps: MemoryMediaUploadQueueDeps): MediaUploadQueue {
  const jobs = new Map<string, PendingMediaUpload>();
  const now = deps.now ?? defaultNow;
  const createId = deps.createId ?? defaultId;
  const backoffMs = deps.backoffMs ?? defaultBackoffMs;

  return {
    async enqueue(input: AttachImageInput) {
      if (!input.storagePath) throw new Error('storagePath is required.');

      const timestamp = now();
      const job: PendingMediaUpload = {
        id: createId(),
        processId: input.processId,
        stepId: input.stepId ?? null,
        localPath: input.storagePath,
        contentType: input.contentType ?? null,
        byteSize: input.byteSize ?? null,
        caption: input.caption ?? '',
        position: input.position,
        isCover: input.isCover ?? false,
        attempts: 0,
        nextAttemptAt: timestamp,
        lastError: null,
        createdAt: timestamp,
      };
      jobs.set(job.id, job);
      return job;
    },

    async listPending() {
      return [...jobs.values()].sort(
        (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
      );
    },

    async drain(): Promise<MediaUploadDrainResult> {
      let uploaded = 0;
      let failed = 0;
      let deferred = 0;
      const clock = now();

      const ordered = [...jobs.values()].sort(
        (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
      );

      for (const job of ordered) {
        if (!deps.isOnline()) {
          deferred += 1;
          continue;
        }

        // ISO timestamps compare lexicographically.
        if (job.nextAttemptAt > clock) {
          deferred += 1;
          continue;
        }

        try {
          await deps.media.attachImage({
            processId: job.processId,
            stepId: job.stepId,
            storagePath: job.localPath,
            contentType: job.contentType,
            byteSize: job.byteSize,
            caption: job.caption,
            position: job.position,
            isCover: job.isCover,
          });
          jobs.delete(job.id);
          uploaded += 1;
        } catch (error) {
          const attempts = job.attempts + 1;
          const delay = backoffMs(attempts);
          const updated: PendingMediaUpload = {
            ...job,
            attempts,
            nextAttemptAt: new Date(Date.parse(clock) + delay).toISOString(),
            lastError: error instanceof Error ? error.message : String(error),
          };
          jobs.set(job.id, updated);
          failed += 1;
        }
      }

      return { uploaded, failed, deferred };
    },

    async clearLocal() {
      jobs.clear();
    },
  };
}
