import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import type {
  AuthCallbackResult,
  AuthEvent,
  AuthPort,
  AuthSession,
  SignUpResult,
} from '@/src/ports/auth';

function toAuthSession(session: Session | null): AuthSession | null {
  if (!session?.user) return null;
  return {
    user: {
      id: session.user.id,
      email: session.user.email ?? null,
    },
    accessToken: session.access_token,
  };
}

function toAuthEvent(event: AuthChangeEvent): AuthEvent {
  switch (event) {
    case 'SIGNED_IN':
      return 'signed-in';
    case 'SIGNED_OUT':
      return 'signed-out';
    case 'PASSWORD_RECOVERY':
      return 'password-recovery';
    default:
      return 'other';
  }
}

function mapAuthError(error: { message: string }): Error {
  if (/invalid login credentials/i.test(error.message)) {
    return new Error('That password does not match this account.');
  }
  return error instanceof Error ? error : new Error(error.message);
}

function authParams(url: string): URLSearchParams {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.search);
  const hash = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash;
  const hashParams = new URLSearchParams(hash);
  hashParams.forEach((value, key) => {
    if (!params.has(key)) params.set(key, value);
  });
  return params;
}

/**
 * Supabase Auth adapter. Email/password, reset, and email deep links.
 * SSO is a later slice.
 */
export function createSupabaseAuthAdapter(client: SupabaseClient): AuthPort {
  let recoveryPending = false;

  client.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') recoveryPending = true;
  });

  return {
    async getSession() {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return toAuthSession(data.session);
    },

    async signInWithPassword(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw mapAuthError(error);
      const session = toAuthSession(data.session);
      if (!session) throw new Error('Sign in succeeded but no session was returned.');
      return session;
    },

    async signUpWithPassword(email, password): Promise<SignUpResult> {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: Linking.createURL('/') },
      });
      if (error) throw error;
      if (!data.session) return { status: 'confirm-email' };
      return { status: 'signed-in' };
    },

    async requestPasswordReset(email) {
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: Linking.createURL('/reset-password'),
      });
      if (error) throw error;
    },

    async reauthenticate(password) {
      const { data, error: userError } = await client.auth.getUser();
      if (userError) throw userError;
      const email = data.user?.email;
      if (!email) throw new Error('This account has no email to confirm with.');
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw mapAuthError(error);
    },

    async updatePassword(password) {
      if (!password) throw new Error('Enter a new password.');
      const { error } = await client.auth.updateUser({ password });
      if (error) throw mapAuthError(error);
    },

    async consumeAuthCallback(url): Promise<AuthCallbackResult> {
      // Web adopts the session during client startup (detectSessionInUrl).
      if (Platform.OS === 'web') return { session: null, recovery: false, error: null };

      let params: URLSearchParams;
      try {
        params = authParams(url);
      } catch {
        return { session: null, recovery: false, error: null };
      }

      const errorDescription = params.get('error_description');
      if (params.get('error') || errorDescription) {
        return {
          session: null,
          recovery: params.get('type') === 'recovery',
          error: errorDescription?.replace(/\+/g, ' ') ?? 'This link is invalid or expired.',
        };
      }

      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (!accessToken || !refreshToken) {
        return { session: null, recovery: false, error: null };
      }

      const recovery = params.get('type') === 'recovery';
      const { data, error } = await client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) {
        return { session: null, recovery, error: error.message };
      }
      if (recovery) recoveryPending = true;
      return { session: toAuthSession(data.session), recovery, error: null };
    },

    consumePasswordRecovery() {
      const pending = recoveryPending;
      recoveryPending = false;
      return pending;
    },

    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    },

    onAuthStateChange(listener) {
      const { data } = client.auth.onAuthStateChange((event, session) => {
        listener(toAuthSession(session), toAuthEvent(event));
      });
      return () => {
        data.subscription.unsubscribe();
      };
    },
  };
}
