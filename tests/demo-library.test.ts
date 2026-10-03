import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createMemoryProcessRepository } from '../src/adapters/memory/process-repository';
import { seedDemoLibrary } from '../src/dev/demo-library';

describe('seedDemoLibrary (dev-only helper)', () => {
  it('seeds hobby sample processes once for an empty library', async () => {
    const processes = createMemoryProcessRepository();
    const ownerId = 'user_demo';

    const first = await seedDemoLibrary(processes, ownerId);
    assert.equal(first.seeded, true);
    assert.ok(first.count >= 2);

    const list = await processes.listProcesses(ownerId);
    assert.equal(list.length, first.count);
    assert.ok(list.some((process) => /pack|tune|setup|glaze|garden/i.test(process.title)));

    const second = await seedDemoLibrary(processes, ownerId);
    assert.equal(second.seeded, false);
    assert.equal(second.count, first.count);
    assert.equal((await processes.listProcesses(ownerId)).length, first.count);
  });
});
