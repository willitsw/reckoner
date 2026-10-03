import type {
  AuthCallbackResult,
  AuthEvent,
  AuthPort,
  AuthSession,
  OAuthProvider,
  SignInWithProviderResult,
  SignUpResult,
} from '@/src/ports/auth';

export type MemoryOAuthBehavior =
  | { behavior?: 'success' }
  | { behavior: 'cancelled' }
  | { behavior: 'error'; message: string };

export type MemoryAuthOptions = {
  /** Controls `signInWithProvider` outcomes for tests and scaffolding. Defaults to success. */
  oauth?: MemoryOAuthBehavior;
};

/**
 * In-memory auth for UI scaffolding before Supabase is wired.
 * Password reset and email confirmation are no-ops: there is no mail to send.
 */
export function createMemoryAuthAdapter(options: MemoryAuthOptions = {}): AuthPort {
  let session: AuthSession | null = null;
  const listeners = new Set<(s: AuthSession | null, event: AuthEvent) => void>();
  const oauth = options.oauth ?? { behavior: 'success' };

  const emit = (event: AuthEvent) => {
    for (const listener of listeners) listener(session, event);
  };

  return {
    async getSession() {
      return session;
    },
    async signInWithPassword(email, _password) {
      session = {
        user: { id: 'local-dev-user', email },
        accessToken: 'memory-token',
      };
      emit('signed-in');
      return session;
    },
    async signUpWithPassword(email, password): Promise<SignUpResult> {
      await this.signInWithPassword(email, password);
      return { status: 'signed-in' };
    },
    async signInWithProvider(provider: OAuthProvider): Promise<SignInWithProviderResult> {
      if (oauth.behavior === 'cancelled') {
        return { status: 'cancelled' };
      }
      if (oauth.behavior === 'error') {
        return { status: 'error', message: oauth.message };
      }

      const email = provider === 'apple' ? 'apple-user@example.com' : 'google-user@example.com';
      session = {
        user: { id: `memory-${provider}-user`, email },
        accessToken: `memory-${provider}-token`,
      };
      emit('signed-in');
      return { status: 'signed-in', session };
    },
    async requestPasswordReset() {},
    async reauthenticate(password) {
      if (!session) throw new Error('Sign in to confirm this account.');
      if (!password) throw new Error('That password does not match this account.');
    },
    async updatePassword(password) {
      if (!session) throw new Error('Sign in to update this password.');
      if (!password) throw new Error('Enter a new password.');
    },
    async consumeAuthCallback(): Promise<AuthCallbackResult> {
      return { session, recovery: false, error: null };
    },
    consumePasswordRecovery() {
      return false;
    },
    async signOut() {
      session = null;
      emit('signed-out');
    },
    onAuthStateChange(listener) {
      listeners.add(listener);
      listener(session, session ? 'signed-in' : 'signed-out');
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
