import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createMemoryAccountAdapter } from '../src/adapters/memory/account';
import { createMemoryAuthAdapter } from '../src/adapters/memory/auth';
import { createMemoryProcessRepository } from '../src/adapters/memory/process-repository';
import { DISPLAY_NAME_MAX_LENGTH } from '../src/domain/display-name';
import { withLocalWipe } from '../src/modules/account/with-local-wipe';
import type { AccountPort } from '../src/ports/account';
import type { AuthPort } from '../src/ports/auth';

function signedInAccount() {
  const auth = createMemoryAuthAdapter();
  const account = createMemoryAccountAdapter(auth);
  return { auth, account };
}

async function signIn(auth: AuthPort, email = 'ada@example.com') {
  return auth.signInWithPassword(email, 'secret');
}

describe('account', () => {
  it('is absent until someone is signed in', async () => {
    const { account } = signedInAccount();
    assert.equal(await account.getAccount(), null);
  });

  it('returns the signed-in email on the free plan', async () => {
    const { auth, account } = signedInAccount();
    const session = await signIn(auth);

    const loaded = await account.getAccount();
    assert.equal(loaded?.id, session.user.id);
    assert.equal(loaded?.email, 'ada@example.com');
    assert.equal(loaded?.displayName, null);
    assert.equal(loaded?.plan, 'free');
  });

  it('refuses a name change when signed out', async () => {
    const { account } = signedInAccount();
    await assert.rejects(() => account.updateDisplayName('Ada'), /Sign in to update this account/);
  });

  it('saves a trimmed name and treats blank as cleared', async () => {
    const { auth, account } = signedInAccount();
    await signIn(auth);

    const saved = await account.updateDisplayName('  Ada Lovelace  ');
    assert.equal(saved.displayName, 'Ada Lovelace');
    assert.equal((await account.getAccount())?.displayName, 'Ada Lovelace');

    const cleared = await account.updateDisplayName('   ');
    assert.equal(cleared.displayName, null);
    assert.equal((await account.getAccount())?.displayName, null);
  });

  it('rejects a name that is too long and keeps the previous one', async () => {
    const { auth, account } = signedInAccount();
    await signIn(auth);
    await account.updateDisplayName('Ada');

    await assert.rejects(
      () => account.updateDisplayName('a'.repeat(DISPLAY_NAME_MAX_LENGTH + 1)),
      /80 characters or fewer/,
    );
    assert.equal((await account.getAccount())?.displayName, 'Ada');
  });

  it('delete signs out and does not keep the name for the next sign-in', async () => {
    const { auth, account } = signedInAccount();
    await signIn(auth);
    await account.updateDisplayName('Ada');

    await account.deleteAccount();

    assert.equal(await auth.getSession(), null);
    assert.equal(await account.getAccount(), null);

    await signIn(auth);
    assert.equal((await account.getAccount())?.displayName, null);
  });

  it('delete also drops the local process copy', async () => {
    const { auth, account } = signedInAccount();
    const processes = createMemoryProcessRepository();
    const deleting: AccountPort = withLocalWipe(account, processes);
    const session = await signIn(auth);
    const created = await processes.createProcess({ ownerId: session.user.id, title: 'Sourdough' });

    await deleting.deleteAccount();

    assert.equal(await processes.getProcess(created.id), null);
    assert.deepEqual(await processes.listProcesses(session.user.id), []);
  });

  it('does not clear local processes when delete fails', async () => {
    const { auth, account } = signedInAccount();
    const processes = createMemoryProcessRepository();
    const failing: AccountPort = {
      ...account,
      async deleteAccount() {
        throw new Error('could not delete');
      },
    };
    const deleting = withLocalWipe(failing, processes);
    const session = await signIn(auth);
    const created = await processes.createProcess({ ownerId: session.user.id, title: 'Sourdough' });

    await assert.rejects(() => deleting.deleteAccount(), /could not delete/);
    assert.equal((await processes.getProcess(created.id))?.title, 'Sourdough');
  });
});

describe('password change', () => {
  it('requires a signed-in account and a non-empty current password', async () => {
    const auth = createMemoryAuthAdapter();

    await assert.rejects(() => auth.reauthenticate('secret'), /Sign in to confirm this account/);
    await signIn(auth);
    await assert.rejects(() => auth.reauthenticate(''), /does not match this account/);
    await auth.reauthenticate('secret');
  });

  it('requires a signed-in account and a non-empty new password', async () => {
    const auth = createMemoryAuthAdapter();

    await assert.rejects(() => auth.updatePassword('next-secret'), /Sign in to update this password/);
    await signIn(auth);
    await assert.rejects(() => auth.updatePassword(''), /Enter a new password/);
    await auth.updatePassword('next-secret');
  });
});
