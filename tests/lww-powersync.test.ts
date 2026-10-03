import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import { applyPulledProcess } from '../src/adapters/powersync/apply-pulled-process';
import { decideLww } from '../src/domain/lww';
import { createPowerSyncLibraryForTests } from './helpers/powersync-test-db';

const openLibs: Array<{ close: () => Promise<void> }> = [];

after(async () => {
  await Promise.all(openLibs.splice(0).map((lib) => lib.close()));
});

describe('last-write-wins by updated_at', () => {
  it('applies a fake pull when remote updated_at is newer', async () => {
    const lib = await createPowerSyncLibraryForTests();
    openLibs.push(lib);

    const local = await lib.processes.createProcess({
      ownerId: 'user_1',
      title: 'Local draft',
      notes: 'mine',
    });

    const remoteUpdatedAt = new Date(Date.parse(local.updatedAt) + 60_000).toISOString();
    const decision = await applyPulledProcess(lib.db, {
      id: local.id,
      owner_id: local.ownerId,
      created_by: local.createdBy,
      updated_by: 'user_other_device',
      title: 'Pulled from elsewhere',
      notes: 'theirs',
      pinned_at: null,
      archived_at: null,
      created_at: local.createdAt,
      updated_at: remoteUpdatedAt,
      deleted_at: null,
    });

    assert.equal(decision, 'applied');
    const afterPull = await lib.processes.getProcess(local.id);
    assert.ok(afterPull);
    assert.equal(afterPull.title, 'Pulled from elsewhere');
    assert.equal(afterPull.notes, 'theirs');
    assert.equal(afterPull.updatedAt, remoteUpdatedAt);
    assert.equal(afterPull.updatedBy, 'user_other_device');
  });

  it('keeps local row when remote updated_at is older', async () => {
    const lib = await createPowerSyncLibraryForTests();
    openLibs.push(lib);

    const local = await lib.processes.createProcess({
      ownerId: 'user_1',
      title: 'Local wins',
      notes: 'keep me',
    });

    const olderUpdatedAt = new Date(Date.parse(local.updatedAt) - 60_000).toISOString();
    const decision = await applyPulledProcess(lib.db, {
      id: local.id,
      owner_id: local.ownerId,
      created_by: local.createdBy,
      updated_by: 'user_stale',
      title: 'Stale remote',
      notes: 'should not apply',
      pinned_at: null,
      archived_at: null,
      created_at: local.createdAt,
      updated_at: olderUpdatedAt,
      deleted_at: null,
    });

    assert.equal(decision, 'kept_local');
    const afterPull = await lib.processes.getProcess(local.id);
    assert.ok(afterPull);
    assert.equal(afterPull.title, 'Local wins');
    assert.equal(afterPull.notes, 'keep me');
    assert.equal(afterPull.updatedAt, local.updatedAt);
  });

  it('inserts when the pulled row is new', async () => {
    const lib = await createPowerSyncLibraryForTests();
    openLibs.push(lib);

    const remoteId = globalThis.crypto.randomUUID();
    const now = new Date().toISOString();
    const decision = await applyPulledProcess(lib.db, {
      id: remoteId,
      owner_id: 'user_1',
      created_by: 'user_1',
      updated_by: 'user_1',
      title: 'Brand new from sync',
      notes: '',
      pinned_at: null,
      archived_at: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });

    assert.equal(decision, 'applied');
    const loaded = await lib.processes.getProcess(remoteId);
    assert.ok(loaded);
    assert.equal(loaded.title, 'Brand new from sync');
  });
});

describe('decideLww (pure)', () => {
  it('chooses apply when remote is newer or local is missing', () => {
    assert.equal(
      decideLww({ localUpdatedAt: '2026-01-01T00:00:00.000Z', remoteUpdatedAt: '2026-01-02T00:00:00.000Z' }),
      'apply',
    );
    assert.equal(decideLww({ localUpdatedAt: null, remoteUpdatedAt: '2026-01-02T00:00:00.000Z' }), 'apply');
  });

  it('chooses keep when remote is older or equal', () => {
    assert.equal(
      decideLww({ localUpdatedAt: '2026-01-02T00:00:00.000Z', remoteUpdatedAt: '2026-01-01T00:00:00.000Z' }),
      'keep',
    );
    assert.equal(
      decideLww({ localUpdatedAt: '2026-01-02T00:00:00.000Z', remoteUpdatedAt: '2026-01-02T00:00:00.000Z' }),
      'keep',
    );
  });
});
