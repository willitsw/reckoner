import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createMemoryAuthAdapter } from '../src/adapters/memory/auth';
import type { AuthEvent, AuthSession, OAuthProvider } from '../src/ports/auth';

describe('AuthPort OAuth providers', () => {
  it('signs in with a provider and returns a session', async () => {
    const auth = createMemoryAuthAdapter();

    const result = await auth.signInWithProvider('google');

    assert.equal(result.status, 'signed-in');
    if (result.status !== 'signed-in') return;
    assert.equal(result.session.user.email, 'google-user@example.com');
    assert.ok(result.session.accessToken);
    assert.deepEqual(await auth.getSession(), result.session);
  });

  it('signs in with Apple the same way', async () => {
    const auth = createMemoryAuthAdapter();

    const result = await auth.signInWithProvider('apple');

    assert.equal(result.status, 'signed-in');
    if (result.status !== 'signed-in') return;
    assert.equal(result.session.user.email, 'apple-user@example.com');
  });

  it('reports cancellation without creating a session', async () => {
    const auth = createMemoryAuthAdapter({ oauth: { behavior: 'cancelled' } });

    const result = await auth.signInWithProvider('google');

    assert.deepEqual(result, { status: 'cancelled' });
    assert.equal(await auth.getSession(), null);
  });

  it('reports provider errors without creating a session', async () => {
    const auth = createMemoryAuthAdapter({
      oauth: { behavior: 'error', message: 'Provider unavailable' },
    });

    const result = await auth.signInWithProvider('google');

    assert.deepEqual(result, { status: 'error', message: 'Provider unavailable' });
    assert.equal(await auth.getSession(), null);
  });

  it('emits signed-in onAuthStateChange when provider sign-in succeeds', async () => {
    const auth = createMemoryAuthAdapter();
    const events: { session: AuthSession | null; event: AuthEvent }[] = [];

    auth.onAuthStateChange((session, event) => {
      events.push({ session, event });
    });
    // Initial sync callback is present; clear so we only assert the OAuth transition.
    events.length = 0;

    const result = await auth.signInWithProvider('google');

    assert.equal(result.status, 'signed-in');
    assert.equal(events.length, 1);
    assert.equal(events[0]?.event, 'signed-in');
    assert.equal(events[0]?.session?.user.email, 'google-user@example.com');
  });

  it('does not emit signed-in when the provider flow is cancelled', async () => {
    const auth = createMemoryAuthAdapter({ oauth: { behavior: 'cancelled' } });
    const events: AuthEvent[] = [];

    auth.onAuthStateChange((_session, event) => {
      events.push(event);
    });
    events.length = 0;

    await auth.signInWithProvider('apple');

    assert.deepEqual(events, []);
  });

  it('accepts only known OAuth providers at the type level', () => {
    const providers: OAuthProvider[] = ['google', 'apple'];
    assert.deepEqual(providers, ['google', 'apple']);
  });
});
