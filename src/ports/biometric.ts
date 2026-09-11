/**
 * Local app unlock (Face ID / biometrics). Does not replace cloud auth.
 */
export interface BiometricPort {
  isAvailable(): Promise<boolean>;
  authenticate(promptMessage?: string): Promise<boolean>;
}
