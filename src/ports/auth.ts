import type { SessionUser } from '@/src/domain/types';

export type AuthSession = {
  user: SessionUser;
  accessToken: string;
};

export type AuthEvent = 'signed-in' | 'signed-out' | 'password-recovery' | 'other';

export type SignUpResult = { status: 'signed-in' } | { status: 'confirm-email' };

export type AuthCallbackResult = {
  session: AuthSession | null;
  /** True when the URL was a password-recovery link. */
  recovery: boolean;
  error: string | null;
};

/**
 * Identity and session. Implementations: Supabase, test doubles, etc.
 * Face ID unlock is a separate local gate (BiometricPort), not a provider.
 */
export interface AuthPort {
  getSession(): Promise<AuthSession | null>;
  signInWithPassword(email: string, password: string): Promise<AuthSession>;
  signUpWithPassword(email: string, password: string): Promise<SignUpResult>;
  /** Always resolves when the request is accepted. Does not reveal whether the email exists. */
  requestPasswordReset(email: string): Promise<void>;
  /** Confirms the current password. Required before delete and password change. */
  reauthenticate(password: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  /**
   * Adopts a session from an email deep link. Web sessions are adopted by the
   * client on startup; this is the native path.
   */
  consumeAuthCallback(url: string): Promise<AuthCallbackResult>;
  /**
   * True once if a recovery callback arrived before the UI subscribed.
   * Clears the flag.
   */
  consumePasswordRecovery(): boolean;
  signOut(): Promise<void>;
  onAuthStateChange(listener: (session: AuthSession | null, event: AuthEvent) => void): () => void;
}
