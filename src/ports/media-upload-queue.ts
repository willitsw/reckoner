import type { ProcessId, StepId } from '@/src/domain/types';
import type { AttachImageInput } from '@/src/ports/media-repository';

/**
 * Device-local pending upload. Never synced to Postgres / PowerSync —
 * `media_assets` rows exist only after a successful upload+attach.
 */
export type PendingMediaUpload = {
  id: string;
  processId: ProcessId;
  stepId: StepId | null;
  /** Local capture path (file://, data URI, etc.). Not a cloud object path. */
  localPath: string;
  contentType: string | null;
  byteSize: number | null;
  caption: string;
  position?: string;
  isCover: boolean;
  attempts: number;
  /** ISO time when the job is eligible for another drain attempt. */
  nextAttemptAt: string;
  lastError: string | null;
  createdAt: string;
};

export type MediaUploadDrainResult = {
  uploaded: number;
  failed: number;
  deferred: number;
};

/**
 * Offline media upload queue. Capture enqueues a local job; online drain
 * uploads via MediaRepository.attachImage (Storage then row). Feature code
 * uses this port — never a Storage SDK.
 */
export interface MediaUploadQueue {
  enqueue(input: AttachImageInput): Promise<PendingMediaUpload>;
  listPending(): Promise<PendingMediaUpload[]>;
  /** Process ready jobs when online. Defers when offline or still in backoff. */
  drain(): Promise<MediaUploadDrainResult>;
  /** Drops this device's pending jobs. Does not delete cloud media. */
  clearLocal(): Promise<void>;
}
