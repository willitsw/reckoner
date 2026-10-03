import type { MediaAsset } from '@/src/domain/types';

/** Images for the image media strip / read-only image view. */
export function definitionImages(assets: readonly MediaAsset[]): MediaAsset[] {
  return assets.filter((asset) => asset.kind === 'image');
}

/** Audio for the editor strip and read-only run playback. */
export function definitionAudio(assets: readonly MediaAsset[]): MediaAsset[] {
  return assets.filter((asset) => asset.kind === 'audio');
}
