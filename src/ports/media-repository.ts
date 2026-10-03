import type { MediaAsset, MediaId, ProcessId, StepId } from '@/src/domain/types';

export type AttachImageInput = {
  processId: ProcessId;
  /** Null / omitted = process-level attachment. */
  stepId?: StepId | null;
  /** Local path, file://, data URI, or opaque local id. Required after capture. */
  storagePath: string;
  contentType?: string | null;
  byteSize?: number | null;
  caption?: string;
  position?: string;
  isCover?: boolean;
};

/** Audio never carries cover; use attachImage for covers. */
export type AttachAudioInput = {
  processId: ProcessId;
  /** Null / omitted = process-level attachment. */
  stepId?: StepId | null;
  /** Local path, file://, data URI, or opaque local id. Required after capture. */
  storagePath: string;
  contentType?: string | null;
  byteSize?: number | null;
  caption?: string;
  position?: string;
};

export type UpdateMediaPatch = Partial<Pick<MediaAsset, 'caption' | 'position' | 'isCover'>>;

/**
 * Definition media (how-to images/audio). Not run captures.
 */
export interface MediaRepository {
  /** Non-deleted media for the process (process-level + all steps). */
  listForProcess(processId: ProcessId): Promise<MediaAsset[]>;
  /** Siblings in one attachment group. Null step = process-level. */
  listForStep(processId: ProcessId, stepId: StepId | null): Promise<MediaAsset[]>;
  /** Create an image row after local capture succeeds. */
  attachImage(input: AttachImageInput): Promise<MediaAsset>;
  /** Create an audio row after local capture succeeds. Never cover. */
  attachAudio(input: AttachAudioInput): Promise<MediaAsset>;
  updateMedia(id: MediaId, patch: UpdateMediaPatch): Promise<MediaAsset>;
  softDelete(id: MediaId): Promise<void>;
  /** Drops this device's copy. Does not delete cloud media. */
  clearLocal(): Promise<void>;
}
