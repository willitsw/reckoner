import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createMemoryAuthAdapter } from '../src/adapters/memory/auth';
import { createMemoryBiometricAdapter } from '../src/adapters/memory/biometric';
import { createAppLockGate } from '../src/modules/auth/app-lock-gate';

describe('biometric app lock', () => {
  it('locks when a cloud session exists and Face ID is enabled', async () => {
    const auth = createMemoryAuthAdapter();
    const biometrics = createMemoryBiometricAdapter({ available: true, lockEnabled: true });
    const gate = createAppLockGate(biometrics);

    await auth.signInWithPassword('ada@example.com', 'secret');
    const state = await gate.bootstrap({ hasSession: true });

    assert.equal(state.available, true);
    assert.equal(state.enabled, true);
    assert.equal(state.locked, true);
    assert.equal(state.label, 'Face ID');
  });

  it('unlocks after a successful biometric prompt', async () => {
    const biometrics = createMemoryBiometricAdapter({ available: true, lockEnabled: true });
    const gate = createAppLockGate(biometrics);
    await gate.bootstrap({ hasSession: true });

    biometrics.nextAuthenticateResult = true;
    const unlocked = await gate.unlock();

    assert.equal(unlocked, true);
    assert.equal(gate.getState({ hasSession: true }).locked, false);
    assert.match(biometrics.lastPromptMessage ?? '', /Unlock with Face ID/);
  });

  it('stays locked when the biometric prompt is cancelled', async () => {
    const biometrics = createMemoryBiometricAdapter({ available: true, lockEnabled: true });
    const gate = createAppLockGate(biometrics);
    await gate.bootstrap({ hasSession: true });

    biometrics.nextAuthenticateResult = false;
    const unlocked = await gate.unlock();

    assert.equal(unlocked, false);
    assert.equal(gate.getState({ hasSession: true }).locked, true);
  });

  it('disables the lock only after biometric confirmation', async () => {
    const biometrics = createMemoryBiometricAdapter({ available: true, lockEnabled: true });
    const gate = createAppLockGate(biometrics);
    await gate.bootstrap({ hasSession: true });

    biometrics.nextAuthenticateResult = false;
    assert.equal(await gate.setLockEnabled(false), false);
    assert.equal(await biometrics.isLockEnabled(), true);
    assert.equal(gate.getState({ hasSession: true }).enabled, true);
    assert.equal(gate.getState({ hasSession: true }).locked, true);

    biometrics.nextAuthenticateResult = true;
    assert.equal(await gate.setLockEnabled(false), true);
    assert.equal(await biometrics.isLockEnabled(), false);
    assert.equal(gate.getState({ hasSession: true }).enabled, false);
    assert.equal(gate.getState({ hasSession: true }).locked, false);
  });

  it('does not treat biometric unlock as a cloud session', async () => {
    const auth = createMemoryAuthAdapter();
    const biometrics = createMemoryBiometricAdapter({ available: true, lockEnabled: true });
    const gate = createAppLockGate(biometrics);

    biometrics.nextAuthenticateResult = true;
    assert.equal(await biometrics.authenticate('Unlock'), true);
    assert.equal(await auth.getSession(), null);

    const signedOut = await gate.bootstrap({ hasSession: false });
    assert.equal(signedOut.locked, false);

    await auth.signInWithPassword('ada@example.com', 'secret');
    const signedIn = gate.setHasSession(true);
    assert.equal(signedIn.locked, true);

    await auth.signOut();
    const afterSignOut = gate.setHasSession(false);
    assert.equal(afterSignOut.locked, false);
    assert.equal(await auth.getSession(), null);
  });

  it('re-locks on background when a session and preference remain', async () => {
    let now = 1_000;
    const biometrics = createMemoryBiometricAdapter({ available: true, lockEnabled: true });
    const gate = createAppLockGate(biometrics, { now: () => now });
    await gate.bootstrap({ hasSession: true });
    biometrics.nextAuthenticateResult = true;
    await gate.unlock();

    // Post-prompt grace must not immediately re-lock (Face ID backgrounds the app).
    assert.equal(gate.lockForBackground({ hasSession: true }).locked, false);

    now += 1_001;
    assert.equal(gate.lockForBackground({ hasSession: true }).locked, true);
  });

  it('ignores a stored preference when biometrics are unavailable', async () => {
    const biometrics = createMemoryBiometricAdapter({ available: false, lockEnabled: true });
    const gate = createAppLockGate(biometrics);

    const state = await gate.bootstrap({ hasSession: true });
    assert.equal(state.available, false);
    assert.equal(state.enabled, false);
    assert.equal(state.locked, false);
    assert.equal(await biometrics.isLockEnabled(), false);
  });
});
