import type { AuthCallbackResult, AuthPort, AuthSession, SignUpResult } from '@/src/ports/auth';

/**
 * In-memory auth for UI scaffolding before Supabase is wired.
 * Password reset and email confirmation are no-ops: there is no mail to send.
 */
export function createMemoryAuthAdapter(): AuthPort {
  let session: AuthSession | null = null;
  const listeners = new Set<(s: AuthSession | null, event: 'signed-in' | 'signed-out') => void>();

  const emit = (event: 'signed-in' | 'signed-out') => {
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
