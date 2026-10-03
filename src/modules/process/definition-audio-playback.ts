import type { MediaAsset } from '@/src/domain/types';

/**
 * Resolve a URI Expo AV can load from a MediaRepository definition-audio asset.
 * Pure: no network / signing — adapters already expose a playable storagePath when online.
 */
export function definitionAudioPlaybackUri(
  asset: Pick<MediaAsset, 'kind' | 'storagePath' | 'deletedAt'>,
): string | null {
  if (asset.kind !== 'audio') return null;
  if (asset.deletedAt) return null;
  const uri = asset.storagePath.trim();
  return uri.length > 0 ? uri : null;
}
