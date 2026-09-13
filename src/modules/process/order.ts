import { rankBetween } from '@/src/domain/rank';

type Ordered = {
  id: string;
  position: string;
};

/** Fractional position for moving `stepId` to `toIndex` in the current visible order. */
export function positionAfterMove(steps: readonly Ordered[], stepId: string, toIndex: number): string {
  const from = steps.findIndex((step) => step.id === stepId);
  if (from < 0) throw new Error('Step not found.');

  const next = steps.slice();
  const [item] = next.splice(from, 1);
  if (!item) throw new Error('Step not found.');

  const index = Math.max(0, Math.min(toIndex, next.length));
  next.splice(index, 0, item);

  const before = index === 0 ? null : next[index - 1]?.position ?? null;
  const after = index === next.length - 1 ? null : next[index + 1]?.position ?? null;
  return rankBetween(before, after);
}
