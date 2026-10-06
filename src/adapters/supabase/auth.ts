import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { isUnreachableAuthError, mapAuthError } from '@/src/adapters/supabase/map-auth-error';
import type {
  AuthCallbackResult,
  AuthEvent,
  AuthPort,
  AuthSession,
  OAuthProvider,
  SignInWithProviderResult,
  SignUpResult,
} from '@/src/ports/auth';

WebBrowser.maybeCompleteAuthSession();

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

function mapThrownAuthError(error: unknown): Error {
  if (error && typeof error === 'object' && 'message' in error) {
    return mapAuthError(error as { name?: string; message: string });
  }
  return new Error(String(error));
}

/**
 * Supabase Auth adapter. Email/password, OAuth (Google/Apple), reset, and
 * email deep links. Feature UI must call AuthPort — never supabase-js.
 */
export function createSupabaseAuthAdapter(client: SupabaseClient): AuthPort {
  let recoveryPending = false;

  client.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') recoveryPending = true;
  });

  async function sessionFromOAuthUrl(url: string): Promise<SignInWithProviderResult> {
    let params: URLSearchParams;
    try {
      params = authParams(url);
    } catch {
      return { status: 'error', message: 'Sign-in callback was invalid.' };
    }

    const errorDescription = params.get('error_description');
    if (params.get('error') || errorDescription) {
      return {
        status: 'error',
        message: errorDescription?.replace(/\+/g, ' ') ?? 'Sign-in did not complete.',
      };
    }

    const code = params.get('code');
    if (code) {
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      if (error) return { status: 'error', message: error.message };
      const session = toAuthSession(data.session);
      if (!session) {
        return { status: 'error', message: 'Sign in succeeded but no session was returned.' };
      }
      return { status: 'signed-in', session };
    }

    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (!accessToken || !refreshToken) {
      return { status: 'error', message: 'Sign-in did not complete.' };
    }

    const { data, error } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) return { status: 'error', message: error.message };
    const session = toAuthSession(data.session);
    if (!session) {
      return { status: 'error', message: 'Sign in succeeded but no session was returned.' };
    }
    return { status: 'signed-in', session };
  }

  return {
    async getSession() {
      try {
        const { data, error } = await client.auth.getSession();
        // Unreachable backend during bootstrap should not crash the app — treat as signed out.
        if (error) {
          if (isUnreachableAuthError(error)) return null;
          throw mapAuthError(error);
        }
        return toAuthSession(data.session);
      } catch (e) {
        if (e && typeof e === 'object' && isUnreachableAuthError(e as { message: string })) {
          return null;
        }
        throw e instanceof Error ? mapAuthError(e) : e;
      }
    },

    async signInWithPassword(email, password) {
      try {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw mapAuthError(error);
        const session = toAuthSession(data.session);
        if (!session) throw new Error('Sign in succeeded but no session was returned.');
        return session;
      } catch (e) {
        throw mapThrownAuthError(e);
      }
    },

    async signUpWithPassword(email, password): Promise<SignUpResult> {
      try {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: Linking.createURL('/') },
        });
        if (error) throw mapAuthError(error);
        if (!data.session) return { status: 'confirm-email' };
        return { status: 'signed-in' };
      } catch (e) {
        throw mapThrownAuthError(e);
      }
    },

    async signInWithProvider(provider: OAuthProvider): Promise<SignInWithProviderResult> {
      // Apple SSO is iOS-only in product UI; no-op if somehow invoked on web.
      if (provider === 'apple' && Platform.OS === 'web') {
        return { status: 'error', message: 'Sign in with Apple is available on iOS.' };
      }

      const redirectTo = Linking.createURL('/');
      try {
        const { data, error } = await client.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo,
            skipBrowserRedirect: true,
          },
        });
        if (error) return { status: 'error', message: mapAuthError(error).message };
        if (!data.url) return { status: 'error', message: 'Could not start sign-in.' };

        const browserResult = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (browserResult.type === 'cancel' || browserResult.type === 'dismiss') {
          return { status: 'cancelled' };
        }
        if (browserResult.type !== 'success' || !browserResult.url) {
          return { status: 'error', message: 'Sign-in did not complete.' };
        }

        return sessionFromOAuthUrl(browserResult.url);
      } catch (e) {
        return { status: 'error', message: mapThrownAuthError(e).message };
      }
    },

    async requestPasswordReset(email) {
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: Linking.createURL('/reset-password'),
      });
      if (error) throw mapAuthError(error);
    },

    async reauthenticate(password) {
      const { data, error: userError } = await client.auth.getUser();
      if (userError) throw mapAuthError(userError);
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
