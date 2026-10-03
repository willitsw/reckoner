import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { groupDefinitionMedia } from '../src/modules/process/group-definition-media';
import type { MediaAsset } from '../src/domain/types';

function asset(partial: Partial<MediaAsset> & Pick<MediaAsset, 'id' | 'processId'>): MediaAsset {
  return {
    ownerId: 'user_1',
    createdBy: 'user_1',
    updatedBy: 'user_1',
    stepId: null,
    kind: 'image',
    storagePath: `local://${partial.id}`,
    contentType: 'image/jpeg',
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

describe('groupDefinitionMedia', () => {
  it('splits process-level and step-level images and surfaces the cover', () => {
    const processCover = asset({
      id: 'm1',
      processId: 'p1',
      caption: 'Overview',
      isCover: true,
      position: 'a',
    });
    const processExtra = asset({
      id: 'm2',
      processId: 'p1',
      caption: 'Tray',
      position: 'b',
    });
    const stepImage = asset({
      id: 'm3',
      processId: 'p1',
      stepId: 's1',
      caption: 'Bay',
      position: 'c',
    });
    const otherStep = asset({
      id: 'm4',
      processId: 'p1',
      stepId: 's2',
      position: 'd',
    });

    const grouped = groupDefinitionMedia([processCover, processExtra, stepImage, otherStep]);

    assert.deepEqual(
      grouped.processLevel.map((item) => item.id),
      ['m1', 'm2'],
    );
    assert.deepEqual(
      (grouped.byStepId.get('s1') ?? []).map((item) => item.id),
      ['m3'],
    );
    assert.deepEqual(
      (grouped.byStepId.get('s2') ?? []).map((item) => item.id),
      ['m4'],
    );
    assert.equal(grouped.cover?.id, 'm1');
  });

  it('returns empty groups and null cover when there is no media', () => {
    const grouped = groupDefinitionMedia([]);
    assert.deepEqual(grouped.processLevel, []);
    assert.equal(grouped.byStepId.size, 0);
    assert.equal(grouped.cover, null);
  });

  it('never picks audio as cover even if listed first', () => {
    const audio = asset({
      id: 'a1',
      processId: 'p1',
      kind: 'audio',
      storagePath: 'file:///note.m4a',
      contentType: 'audio/mp4',
      isCover: false,
      position: 'a',
    });
    const image = asset({
      id: 'm1',
      processId: 'p1',
      isCover: true,
      position: 'b',
    });
    const grouped = groupDefinitionMedia([audio, image]);
    assert.equal(grouped.cover?.id, 'm1');
    assert.deepEqual(
      grouped.processLevel.map((item) => item.id),
      ['a1', 'm1'],
    );
  });
});
