import type { BiometricPort } from '@/src/ports/biometric';

export type AppLockSnapshot = {
  available: boolean;
  enabled: boolean;
  ready: boolean;
  locked: boolean;
  label: string;
};

type SessionFlags = {
  hasSession: boolean;
};

type GateOptions = {
  /** Injected for tests; defaults to Date.now. */
  now?: () => number;
};

/**
 * Local Face ID gate on top of BiometricPort. Does not create or replace a
 * cloud auth session — callers pass whether one already exists.
 */
export function createAppLockGate(biometrics: BiometricPort, options: GateOptions = {}) {
  const now = options.now ?? Date.now;
  let available = false;
  let enabled = false;
  let ready = false;
  let locked = false;
  let label = 'Face ID';
  let hasSession = false;
  let authenticating = false;
  let ignoreBackgroundUntilMs = 0;

  const snapshot = (): AppLockSnapshot => ({
    available,
    enabled,
    ready,
    locked: hasSession && enabled && locked,
    label,
  });

  const finishPrompt = () => {
    authenticating = false;
    ignoreBackgroundUntilMs = now() + 1000;
  };

  return {
    async bootstrap({ hasSession: nextHasSession }: SessionFlags): Promise<AppLockSnapshot> {
      const [nextAvailable, nextEnabled, nextLabel] = await Promise.all([
        biometrics.isAvailable(),
        biometrics.isLockEnabled(),
        biometrics.label(),
      ]);
      available = nextAvailable;
      enabled = nextAvailable && nextEnabled;
      label = nextLabel;
      ready = true;
      hasSession = nextHasSession;
      locked = hasSession && enabled;
      return snapshot();
    },

    getState(flags?: SessionFlags): AppLockSnapshot {
      if (flags) hasSession = flags.hasSession;
      return snapshot();
    },

    setHasSession(nextHasSession: boolean): AppLockSnapshot {
      const hadSession = hasSession;
      hasSession = nextHasSession;
      if (!hasSession) {
        locked = false;
        return snapshot();
      }
      // Signing in with lock enabled requires Face ID; do not re-lock the same session.
      if (!hadSession && ready && enabled) locked = true;
      return snapshot();
    },

    lockForBackground(flags?: SessionFlags): AppLockSnapshot {
      if (flags) hasSession = flags.hasSession;
      if (authenticating) return snapshot();
      if (now() < ignoreBackgroundUntilMs) return snapshot();
      if (hasSession && enabled) locked = true;
      return snapshot();
    },

    async unlock(): Promise<boolean> {
      authenticating = true;
      try {
        const ok = await biometrics.authenticate(`Unlock with ${label}`);
        if (ok) locked = false;
        return ok;
      } finally {
        finishPrompt();
      }
    },

    async setLockEnabled(next: boolean): Promise<boolean> {
      authenticating = true;
      try {
        const ok = await biometrics.authenticate(next ? `Turn on ${label}` : `Turn off ${label}`);
        if (!ok) return false;
        await biometrics.setLockEnabled(next);
        enabled = next;
        // Turning on stays unlocked until next background; turning off clears the gate.
        if (!next) locked = false;
        return true;
      } finally {
        finishPrompt();
      }
    },
  };
}

export type AppLockGate = ReturnType<typeof createAppLockGate>;
