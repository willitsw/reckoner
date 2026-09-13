import * as Linking from 'expo-linking';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { getContainer } from '@/src/di/container';
import type { AuthSession, SignUpResult } from '@/src/ports/auth';

type SessionContextValue = {
  session: AuthSession | null;
  loading: boolean;
  /** Set when an email recovery link established a session that still needs a new password. */
  pendingPasswordReset: boolean;
  /** Error from an email link, if the session could not be adopted. */
  callbackError: string | null;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string) => Promise<SignUpResult>;
  requestPasswordReset: (email: string) => Promise<void>;
  reauthenticate: (password: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const auth = useMemo(() => getContainer().auth, []);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingPasswordReset, setPendingPasswordReset] = useState(false);
  const [callbackError, setCallbackError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    const unsubscribe = auth.onAuthStateChange((next, event) => {
      if (!alive) return;
      if (event === 'password-recovery') setPendingPasswordReset(true);
      setSession(next);
    });

    const adopt = async (url: string) => {
      const result = await auth.consumeAuthCallback(url);
      if (!alive) return;
      if (result.error) setCallbackError(result.error);
      if (result.recovery) setPendingPasswordReset(true);
      if (result.session) setSession(result.session);
    };

    const linking = Linking.addEventListener('url', ({ url }) => {
      void adopt(url);
    });

    void (async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) await adopt(initialUrl);
        const current = await auth.getSession();
        if (!alive) return;
        setSession(current);
        // Supabase emits PASSWORD_RECOVERY on a timeout after init. Wait one
        // turn so a recovery session cannot skip the new-password screen.
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (!alive) return;
        if (auth.consumePasswordRecovery()) setPendingPasswordReset(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
      unsubscribe();
      linking.remove();
    };
  }, [auth]);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      loading,
      pendingPasswordReset,
      callbackError,
      async signInWithPassword(email, password) {
        setPendingPasswordReset(false);
        await auth.signInWithPassword(email, password);
      },
      signUpWithPassword(email, password) {
        return auth.signUpWithPassword(email, password);
      },
      requestPasswordReset(email) {
        return auth.requestPasswordReset(email);
      },
      reauthenticate(password) {
        return auth.reauthenticate(password);
      },
      async updatePassword(password) {
        await auth.updatePassword(password);
        setPendingPasswordReset(false);
      },
      async signOut() {
        setPendingPasswordReset(false);
        await auth.signOut();
      },
    }),
    [auth, session, loading, pendingPasswordReset, callbackError],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
