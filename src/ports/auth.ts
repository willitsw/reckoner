import type { SessionUser } from '@/src/domain/types';

export type AuthSession = {
  user: SessionUser;
  accessToken: string;
};

/**
 * Identity and session. Implementations: Supabase, test doubles, etc.
 * Face ID unlock is a separate local gate (BiometricPort), not a provider.
 */
export interface AuthPort {
  getSession(): Promise<AuthSession | null>;
  signInWithPassword(email: string, password: string): Promise<AuthSession>;
  signUpWithPassword(email: string, password: string): Promise<AuthSession>;
  signOut(): Promise<void>;
  onAuthStateChange(listener: (session: AuthSession | null) => void): () => void;
}
