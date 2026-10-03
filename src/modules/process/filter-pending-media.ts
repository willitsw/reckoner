import type { ProcessId, StepId } from '@/src/domain/types';
import type { PendingMediaUpload } from '@/src/ports/media-upload-queue';

/** Pending jobs for one process- or step-level media strip. */
export function filterPendingMediaForTarget(
  pending: readonly PendingMediaUpload[],
  processId: ProcessId,
  stepId: StepId | null,
): PendingMediaUpload[] {
  return pending.filter((job) => job.processId === processId && job.stepId === stepId);
}
