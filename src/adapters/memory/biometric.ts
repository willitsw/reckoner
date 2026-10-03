import type { BiometricPort } from '@/src/ports/biometric';

export type MemoryBiometricOptions = {
  available?: boolean;
  lockEnabled?: boolean;
  label?: string;
};

/**
 * In-memory biometrics for app-lock tests. Set `nextAuthenticateResult` to
 * drive success vs cancel on the next `authenticate` call.
 */
export function createMemoryBiometricAdapter(
  options: MemoryBiometricOptions = {},
): BiometricPort & {
  nextAuthenticateResult: boolean;
  lastPromptMessage: string | null;
} {
  let available = options.available ?? true;
  let lockEnabled = options.lockEnabled ?? false;
  const label = options.label ?? 'Face ID';
  let nextAuthenticateResult = true;
  let lastPromptMessage: string | null = null;

  return {
    get nextAuthenticateResult() {
      return nextAuthenticateResult;
    },
    set nextAuthenticateResult(value: boolean) {
      nextAuthenticateResult = value;
    },
    get lastPromptMessage() {
      return lastPromptMessage;
    },

    async isAvailable() {
      return available;
    },

    async label() {
      return label;
    },

    async isLockEnabled() {
      if (!available) return false;
      return lockEnabled;
    },

    async setLockEnabled(enabled) {
      if (enabled && !available) {
        throw new Error('Biometrics are not available on this device.');
      }
      lockEnabled = enabled;
    },

    async authenticate(promptMessage = 'Unlock Reckoner') {
      lastPromptMessage = promptMessage;
      return nextAuthenticateResult;
    },
  };
}
