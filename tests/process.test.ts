import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createMemoryProcessRepository } from '../src/adapters/memory/process-repository';
import { INCLUDE_DEPTH_LIMIT, assertLiveInclude } from '../src/domain/include';
import { rankBetween } from '../src/domain/rank';
import { registerProcessRepositoryContract } from './contracts/process-contract';

registerProcessRepositoryContract('memory', () => createMemoryProcessRepository());

describe('include guard', () => {
  it('rejects a chain that would exceed the safety depth', () => {
    const owner = 'user_1';
    const edges = Array.from({ length: INCLUDE_DEPTH_LIMIT }, (_, index) => ({
      processId: `p${index}`,
      childProcessId: `p${index + 1}`,
    }));

    assert.throws(
      () =>
        assertLiveInclude({
          parentId: 'root',
          childId: 'p0',
          parentOwnerId: owner,
          child: { ownerId: owner, deletedAt: null },
          edges,
        }),
      /deep/,
    );
  });
});

describe('step order keys', () => {
  it('places a key strictly between bounds, including after a jitter suffix', () => {
    const first = rankBetween(null, null, '');
    const second = rankBetween(first, null, 'k');
    const between = rankBetween(first, second, 'z');

    assert.ok(first < second);
    assert.ok(first < between && between < second);
  });
});
