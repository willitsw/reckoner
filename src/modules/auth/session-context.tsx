import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { getContainer } from '@/src/di/container';
import type { AuthSession } from '@/src/ports/auth';

type SessionContextValue = {
  session: AuthSession | null;
  loading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const auth = useMemo(() => getContainer().auth, []);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    auth.getSession().then((s) => {
      if (alive) {
        setSession(s);
        setLoading(false);
      }
    });
    const unsubscribe = auth.onAuthStateChange((s) => {
      if (alive) setSession(s);
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [auth]);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      loading,
      async signInWithPassword(email, password) {
        await auth.signInWithPassword(email, password);
      },
      async signUpWithPassword(email, password) {
        await auth.signUpWithPassword(email, password);
      },
      async signOut() {
        await auth.signOut();
      },
    }),
    [auth, session, loading],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
