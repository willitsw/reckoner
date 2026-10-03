import type { MediaAsset, StepId } from '@/src/domain/types';

export type GroupedDefinitionMedia = {
  processLevel: MediaAsset[];
  byStepId: Map<StepId, MediaAsset[]>;
  cover: MediaAsset | null;
};

/** Split listForProcess results into process-level vs step buckets; preserve order. */
export function groupDefinitionMedia(assets: readonly MediaAsset[]): GroupedDefinitionMedia {
  const processLevel: MediaAsset[] = [];
  const byStepId = new Map<StepId, MediaAsset[]>();
  let cover: MediaAsset | null = null;

  for (const asset of assets) {
    // Cover is image-only; audio never carries isCover but ignore non-images defensively.
    if (asset.kind === 'image' && asset.isCover && cover === null) cover = asset;
    if (asset.stepId === null) {
      processLevel.push(asset);
      continue;
    }
    const siblings = byStepId.get(asset.stepId);
    if (siblings) siblings.push(asset);
    else byStepId.set(asset.stepId, [asset]);
  }

  return { processLevel, byStepId, cover };
}
