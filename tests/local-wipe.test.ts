import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import { createMemoryAccountAdapter } from '../src/adapters/memory/account';
import { createMemoryAuthAdapter } from '../src/adapters/memory/auth';
import { createMemoryLibrary } from '../src/adapters/memory/process-repository';
import { withLocalWipe, withSignOutLocalWipe } from '../src/modules/account/with-local-wipe';
import type { AuthPort } from '../src/ports/auth';
import type { ProcessRepository } from '../src/ports/process-repository';
import type { RunRepository } from '../src/ports/run-repository';
import { createPowerSyncLibraryForTests } from './helpers/powersync-test-db';

async function signIn(auth: AuthPort, email = 'ada@example.com') {
  return auth.signInWithPassword(email, 'secret');
}

async function seedProcessAndRun(
  processes: ProcessRepository,
  runs: RunRepository,
  ownerId: string,
) {
  const process = await processes.createProcess({ ownerId, title: 'Shared device' });
  await processes.createStep({
    processId: process.id,
    kind: 'action',
    body: 'Mix',
  });
  const run = await runs.openRun(process.id);
  return { process, run };
}

async function assertLibraryEmpty(
  processes: ProcessRepository,
  runs: RunRepository,
  ownerId: string,
  processId: string,
) {
  assert.equal(await processes.getProcess(processId), null);
  assert.deepEqual(await processes.listProcesses(ownerId), []);
  assert.equal(await runs.getInProgressRun(processId), null);
}

describe('local library wipe on sign-out and delete (memory)', () => {
  it('sign-out clears local process and run reads', async () => {
    const auth = createMemoryAuthAdapter();
    const { processes, runs } = createMemoryLibrary();
    const wipingAuth = withSignOutLocalWipe(auth, processes);
    const session = await signIn(wipingAuth);
    const { process } = await seedProcessAndRun(processes, runs, session.user.id);
    assert.ok(await runs.getInProgressRun(process.id));

    await wipingAuth.signOut();

    assert.equal(await wipingAuth.getSession(), null);
    await assertLibraryEmpty(processes, runs, session.user.id, process.id);
  });

  it('delete account clears local process and run reads', async () => {
    const auth = createMemoryAuthAdapter();
    const account = createMemoryAccountAdapter(auth);
    const { processes, runs } = createMemoryLibrary();
    const deleting = withLocalWipe(account, processes);
    const session = await signIn(auth);
    const { process } = await seedProcessAndRun(processes, runs, session.user.id);
    assert.ok(await runs.getInProgressRun(process.id));

    await deleting.deleteAccount();

    assert.equal(await auth.getSession(), null);
    await assertLibraryEmpty(processes, runs, session.user.id, process.id);
  });
});

/**
 * PowerSync path: sign-out / delete go through the same wipe wrappers the DI
 * root uses, so local SQLite process + run reads empty even when rows existed.
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
    const { process } = await seedProcessAndRun(lib.processes, lib.runs, session.user.id);
    assert.ok(await lib.runs.getInProgressRun(process.id));

    await wipingAuth.signOut();

    assert.equal(await wipingAuth.getSession(), null);
    await assertLibraryEmpty(lib.processes, lib.runs, session.user.id, process.id);
  });

  it('delete account clears local process and run reads', async () => {
    const lib = await createPowerSyncLibraryForTests();
    openLibs.push(lib);
    const auth = createMemoryAuthAdapter();
    const account = createMemoryAccountAdapter(auth);
    const deleting = withLocalWipe(account, lib.processes);
    const session = await signIn(auth);
    const { process } = await seedProcessAndRun(lib.processes, lib.runs, session.user.id);
    assert.ok(await lib.runs.getInProgressRun(process.id));

    await deleting.deleteAccount();

    assert.equal(await auth.getSession(), null);
    await assertLibraryEmpty(lib.processes, lib.runs, session.user.id, process.id);
  });
});
