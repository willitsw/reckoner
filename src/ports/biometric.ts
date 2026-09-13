/**
 * Local app unlock (Face ID / biometrics). Does not replace cloud auth.
 * The gate is opt-in and device-local.
 */
export interface BiometricPort {
  isAvailable(): Promise<boolean>;
  /** Short label for prompts: "Face ID", "Touch ID", "fingerprint". */
  label(): Promise<string>;
  /** False when the device cannot lock, even if a preference was stored. */
  isLockEnabled(): Promise<boolean>;
  /** Persists the preference. Caller authenticates first. */
  setLockEnabled(enabled: boolean): Promise<void>;
  authenticate(promptMessage?: string): Promise<boolean>;
}
