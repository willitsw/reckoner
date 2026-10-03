import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { MediaAsset } from '../src/domain/types';
import { definitionAudioPlaybackUri } from '../src/modules/process/definition-audio-playback';
import { definitionAudio } from '../src/modules/process/split-definition-media';

function asset(partial: Partial<MediaAsset> & Pick<MediaAsset, 'id' | 'processId'>): MediaAsset {
  return {
    ownerId: 'user_1',
    createdBy: 'user_1',
    updatedBy: 'user_1',
    stepId: null,
    kind: 'audio',
    storagePath: `file:///${partial.id}.m4a`,
    contentType: 'audio/mp4',
    byteSize: 10,
    caption: '',
    position: partial.id,
    isCover: false,
    deletedAt: null,
    createdAt: '2026-10-02T00:00:00.000Z',
    updatedAt: '2026-10-02T00:00:00.000Z',
    ...partial,
  };
}

describe('definitionAudioPlaybackUri', () => {
  it('returns storagePath for playable definition audio', () => {
    const audio = asset({
      id: 'a1',
      processId: 'p1',
      storagePath: 'file:///local/intro.m4a',
    });
    assert.equal(definitionAudioPlaybackUri(audio), 'file:///local/intro.m4a');
  });

  it('rejects images, soft-deleted rows, and blank paths', () => {
    assert.equal(
      definitionAudioPlaybackUri(
        asset({
          id: 'img',
          processId: 'p1',
          kind: 'image',
          storagePath: 'file:///x.jpg',
          contentType: 'image/jpeg',
        }),
      ),
      null,
    );
    assert.equal(
      definitionAudioPlaybackUri(
        asset({
          id: 'gone',
          processId: 'p1',
          deletedAt: '2026-10-02T01:00:00.000Z',
        }),
      ),
      null,
    );
    assert.equal(
      definitionAudioPlaybackUri(asset({ id: 'blank', processId: 'p1', storagePath: '   ' })),
      null,
    );
  });

  it('pairs with definitionAudio so run screen only gets playable rows', () => {
    const mixed = [
      asset({
        id: 'img',
        processId: 'p1',
        kind: 'image',
        storagePath: 'file:///x.jpg',
        contentType: 'image/jpeg',
      }),
      asset({ id: 'ok', processId: 'p1', storagePath: 'file:///ok.m4a', caption: 'Hear me' }),
      asset({
        id: 'dead',
        processId: 'p1',
        storagePath: 'file:///dead.m4a',
        deletedAt: '2026-10-02T01:00:00.000Z',
      }),
    ];
    const playable = definitionAudio(mixed)
      .map((row) => ({ id: row.id, uri: definitionAudioPlaybackUri(row) }))
      .filter((row) => row.uri !== null);
    assert.deepEqual(playable, [{ id: 'ok', uri: 'file:///ok.m4a' }]);
  });
});
