import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createMemoryLibrary } from '../src/adapters/memory/process-repository';
import { expandRun, isSatisfied, occurrencePath } from '../src/domain/run';
import type { Process, Step } from '../src/domain/types';
import { registerRunRepositoryContract } from './contracts/run-contract';

const owner = 'user_1';

function process(id: string, title: string, deletedAt: string | null = null): Process {
  return {
    id,
    ownerId: owner,
    createdBy: owner,
    updatedBy: owner,
    title,
    notes: '',
    pinnedAt: null,
    archivedAt: null,
    deletedAt,
    createdAt: '2026-09-13T00:00:00.000Z',
    updatedAt: '2026-09-13T00:00:00.000Z',
  };
}

function step(partial: Partial<Step> & Pick<Step, 'id' | 'processId' | 'body'>): Step {
  return {
    ownerId: owner,
    createdBy: owner,
    updatedBy: owner,
    position: partial.id,
    kind: 'action',
    optional: false,
    notes: '',
    url: null,
    childProcessId: null,
    deletedAt: null,
    createdAt: '2026-09-13T00:00:00.000Z',
    updatedAt: '2026-09-13T00:00:00.000Z',
    ...partial,
  };
}

registerRunRepositoryContract('memory', () => createMemoryLibrary());

describe('run expansion', () => {
  it('checks the same child twice on different paths, and rolls an include up when its required steps are done', () => {
    const pack = process('pack', 'Pack');
    const camera = process('camera', 'Camera');
    const steps = [
      step({ id: 's1', processId: 'pack', body: 'Kit', childProcessId: 'camera' }),
      step({ id: 's3', processId: 'pack', body: 'Spare kit', childProcessId: 'camera' }),
      step({ id: 's2', processId: 'camera', body: 'Insert battery' }),
      step({ id: 's4', processId: 'camera', body: 'Optional cloth', optional: true }),
      step({ id: 'h1', processId: 'pack', body: 'Before you leave', kind: 'heading', position: 'h' }),
    ];
    const nodes = expandRun({
      processId: 'pack',
      processes: new Map([
        ['pack', pack],
        ['camera', camera],
      ]),
      stepsByProcess: new Map([
        ['pack', steps.filter((item) => item.processId === 'pack')],
        ['camera', steps.filter((item) => item.processId === 'camera')],
      ]),
    });

    const first = nodes.find((node) => node.step.id === 's1');
    const second = nodes.find((node) => node.step.id === 's3');
    assert.equal(first?.path, occurrencePath(['s1']));
    assert.equal(first?.include?.nodes[0]?.path, occurrencePath(['s1', 's2']));
    assert.equal(second?.include?.nodes[0]?.path, occurrencePath(['s3', 's2']));

    const battery = first?.include?.nodes[0]?.path ?? '';
    assert.equal(isSatisfied(first!, new Set([battery])), true);
    assert.equal(isSatisfied(second!, new Set([battery])), false);
    assert.equal(isSatisfied(first!, new Set([first!.path])), true);
  });

  it('does not treat a deleted include as done unless it is explicitly checked', () => {
    const parent = process('parent', 'Session');
    const child = process('child', 'Lights', '2026-09-13T00:00:00.000Z');
    const include = step({ id: 's1', processId: 'parent', body: 'Set lights', childProcessId: 'child' });
    const nodes = expandRun({
      processId: 'parent',
      processes: new Map([
        ['parent', parent],
        ['child', child],
      ]),
      stepsByProcess: new Map([['parent', [include]]]),
    });

    assert.equal(nodes[0]?.include?.unavailable, true);
    assert.equal(isSatisfied(nodes[0]!, new Set()), false);
    assert.equal(isSatisfied(nodes[0]!, new Set([nodes[0]!.path])), true);
  });
});
