import type { AuthPort, AuthSession } from '@/src/ports/auth';

/**
 * In-memory auth for UI scaffolding before Supabase is wired.
 * Replace via DI when EXPO_PUBLIC_SUPABASE_* is configured.
 */
export function createMemoryAuthAdapter(): AuthPort {
  let session: AuthSession | null = null;
  const listeners = new Set<(s: AuthSession | null) => void>();

  const emit = () => {
    for (const listener of listeners) listener(session);
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
      emit();
      return session;
    },
    async signUpWithPassword(email, password) {
      return this.signInWithPassword(email, password);
    },
    async signOut() {
      session = null;
      emit();
    },
    onAuthStateChange(listener) {
      listeners.add(listener);
      listener(session);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
