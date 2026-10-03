/**
 * v1 conflict policy: last-write-wins by ISO-8601 `updated_at` (lexicographic).
 *
 * PowerSync’s op clock is the protocol LWW token during live sync. Product code
 * and fake-pull tests use `updated_at` for apply decisions, library ordering,
 * and optional “updated elsewhere” detection (.plans/data-model.md, architecture).
 */

/** Suggested toast copy when a pull replaces a row the user is editing (UI deferred). */
export const UPDATED_ELSEWHERE_NOTICE = 'Updated elsewhere.';

export type LwwDecision = 'apply' | 'keep';

/** True when `candidateUpdatedAt` is strictly newer than `incumbentUpdatedAt`. */
export function winsByUpdatedAt(candidateUpdatedAt: string, incumbentUpdatedAt: string): boolean {
  return candidateUpdatedAt.localeCompare(incumbentUpdatedAt) > 0;
}

/**
 * Decide whether a pulled/remote row should replace the local incumbent.
 * Missing local → apply. Equal timestamps → keep local (stable; avoids flicker).
 */
export function decideLww(params: {
  localUpdatedAt: string | null | undefined;
  remoteUpdatedAt: string;
}): LwwDecision {
  if (params.localUpdatedAt == null || params.localUpdatedAt === '') {
    return 'apply';
  }
  return winsByUpdatedAt(params.remoteUpdatedAt, params.localUpdatedAt) ? 'apply' : 'keep';
}
