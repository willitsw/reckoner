import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createAlwaysFreeEntitlement,
  createMemoryEntitlement,
} from '../src/adapters/memory/entitlement';
import { createMemoryProcessRepository } from '../src/adapters/memory/process-repository';
import { assertEntitlement } from '../src/modules/billing/assert-entitlement';
import { createProcessWithEntitlement } from '../src/modules/billing/create-process-with-entitlement';

describe('entitlement plan reads', () => {
  it('always-free stub reports the free plan', async () => {
    const entitlements = createAlwaysFreeEntitlement();
    assert.equal(await entitlements.getPlan('user_1'), 'free');
  });

  it('memory adapter can report a paid plan', async () => {
    const entitlements = createMemoryEntitlement({ plan: 'paid' });
    assert.equal(await entitlements.getPlan('user_1'), 'paid');
  });
});

describe('assertEntitlement', () => {
  it('reads the free plan and allows create_process (no hard meters yet)', async () => {
    const entitlements = createMemoryEntitlement({ plan: 'free' });

    const decision = await assertEntitlement(entitlements, 'user_1', 'create_process');

    assert.equal(decision.plan, 'free');
    assert.equal(decision.allowed, true);
  });

  it('reads the paid plan and allows create_process', async () => {
    const entitlements = createMemoryEntitlement({ plan: 'paid' });

    const decision = await assertEntitlement(entitlements, 'user_1', 'create_process');

    assert.equal(decision.plan, 'paid');
    assert.equal(decision.allowed, true);
  });

  it('allows attach_media for both free and paid', async () => {
    const free = await assertEntitlement(
      createMemoryEntitlement({ plan: 'free' }),
      'user_1',
      'attach_media',
    );
    const paid = await assertEntitlement(
      createMemoryEntitlement({ plan: 'paid' }),
      'user_1',
      'attach_media',
    );

    assert.equal(free.plan, 'free');
    assert.equal(free.allowed, true);
    assert.equal(paid.plan, 'paid');
    assert.equal(paid.allowed, true);
  });
});

describe('createProcessWithEntitlement', () => {
  it('creates a process for a free plan (gate no-ops)', async () => {
    const entitlements = createAlwaysFreeEntitlement();
    const processes = createMemoryProcessRepository();

    const created = await createProcessWithEntitlement(entitlements, processes, {
      ownerId: 'user_1',
      title: 'Free sourdough',
    });

    assert.equal(created.ownerId, 'user_1');
    assert.equal(created.title, 'Free sourdough');
    assert.equal((await processes.getProcess(created.id))?.title, 'Free sourdough');
  });

  it('creates a process for a paid plan', async () => {
    const entitlements = createMemoryEntitlement({ plan: 'paid' });
    const processes = createMemoryProcessRepository();

    const created = await createProcessWithEntitlement(entitlements, processes, {
      ownerId: 'user_2',
      title: 'Paid brew day',
    });

    assert.equal(created.ownerId, 'user_2');
    assert.equal(created.title, 'Paid brew day');
  });
});
