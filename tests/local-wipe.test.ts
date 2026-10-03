import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import { createMemoryAccountAdapter } from '../src/adapters/memory/account';
import { createMemoryAuthAdapter } from '../src/adapters/memory/auth';
import { withLocalWipe, withSignOutLocalWipe } from '../src/modules/account/with-local-wipe';
import type { AuthPort } from '../src/ports/auth';
import { createPowerSyncLibraryForTests } from './helpers/powersync-test-db';

async function signIn(auth: AuthPort, email = 'ada@example.com') {
  return auth.signInWithPassword(email, 'secret');
}

/**
 * PowerSync path: sign-out / delete go through the same wipe wrappers the DI
 * root uses, so local SQLite process + run reads empty even when rows existed.
 * Memory coverage lives in account.test.ts.
 */
describe('local library wipe on sign-out and delete (powersync-sqlite)', () => {
  const openLibs: Array<{ close: () => Promise<void> }> = [];

  after(async () => {
    await Promise.all(openLibs.splice(0).map((lib) => lib.close()));
  });

  it('sign-out clears local process and run reads', async () => {
    const lib = await createPowerSyncLibraryForTests();
    openLibs.push(lib);
    const auth = createMemoryAuthAdapter();
    const wipingAuth = withSignOutLocalWipe(auth, lib.processes);
    const session = await signIn(wipingAuth);
    const process = await lib.processes.createProcess({
      ownerId: session.user.id,
      title: 'Shared device',
    });
    await lib.runs.openRun(process.id);
    assert.ok(await lib.runs.getInProgressRun(process.id));

    await wipingAuth.signOut();

    assert.equal(await wipingAuth.getSession(), null);
    assert.equal(await lib.processes.getProcess(process.id), null);
    assert.deepEqual(await lib.processes.listProcesses(session.user.id), []);
    assert.equal(await lib.runs.getInProgressRun(process.id), null);
  });

  it('delete account clears local process and run reads', async () => {
    const lib = await createPowerSyncLibraryForTests();
    openLibs.push(lib);
    const auth = createMemoryAuthAdapter();
    const account = createMemoryAccountAdapter(auth);
    const deleting = withLocalWipe(account, lib.processes);
    const session = await signIn(auth);
    const process = await lib.processes.createProcess({
      ownerId: session.user.id,
      title: 'Shared device',
    });
    await lib.runs.openRun(process.id);
    assert.ok(await lib.runs.getInProgressRun(process.id));

    await deleting.deleteAccount();

    assert.equal(await auth.getSession(), null);
    assert.equal(await lib.processes.getProcess(process.id), null);
    assert.deepEqual(await lib.processes.listProcesses(session.user.id), []);
    assert.equal(await lib.runs.getInProgressRun(process.id), null);
  });
});
