import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { getContainer } from '@/src/di/container';
import { useSession } from '@/src/modules/auth/session-context';

type AppLockContextValue = {
  available: boolean;
  enabled: boolean;
  ready: boolean;
  locked: boolean;
  label: string;
  unlock: () => Promise<boolean>;
  setLockEnabled: (enabled: boolean) => Promise<boolean>;
};

const AppLockContext = createContext<AppLockContextValue | null>(null);

export function AppLockProvider({ children }: { children: ReactNode }) {
  const { session, loading: sessionLoading } = useSession();
  const biometrics = useMemo(() => getContainer().biometrics, []);
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [label, setLabel] = useState('Face ID');
  const authenticating = useRef(false);
  const ignoreBackgroundUntil = useRef(0);
  const bootstrapped = useRef(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [nextAvailable, nextEnabled, nextLabel] = await Promise.all([
        biometrics.isAvailable(),
        biometrics.isLockEnabled(),
        biometrics.label(),
      ]);
      if (!alive) return;
      setAvailable(nextAvailable);
      setEnabled(nextAvailable && nextEnabled);
      setLabel(nextLabel);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [biometrics]);

  useEffect(() => {
    if (!ready || sessionLoading || bootstrapped.current) return;
    bootstrapped.current = true;
    if (session && enabled) setLocked(true);
  }, [ready, sessionLoading, session, enabled]);

  useEffect(() => {
    if (!session) setLocked(false);
  }, [session]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'background') return;
      if (authenticating.current) return;
      if (Date.now() < ignoreBackgroundUntil.current) return;
      if (session && enabled) setLocked(true);
    });
    return () => sub.remove();
  }, [session, enabled]);

  const finishPrompt = () => {
    authenticating.current = false;
    ignoreBackgroundUntil.current = Date.now() + 1000;
  };

  const unlock = useCallback(async () => {
    authenticating.current = true;
    try {
      const ok = await biometrics.authenticate(`Unlock with ${label}`);
      if (ok) setLocked(false);
      return ok;
    } finally {
      finishPrompt();
    }
  }, [biometrics, label]);

  const setLockEnabled = useCallback(
    async (next: boolean) => {
      authenticating.current = true;
      try {
        const ok = await biometrics.authenticate(next ? `Turn on ${label}` : `Turn off ${label}`);
        if (!ok) return false;
        await biometrics.setLockEnabled(next);
        setEnabled(next);
        if (!next) setLocked(false);
        return true;
      } finally {
        finishPrompt();
      }
    },
    [biometrics, label],
  );

  const value = useMemo<AppLockContextValue>(
    () => ({
      available,
      enabled,
      ready,
      locked:
        Boolean(session) &&
        enabled &&
        (locked || (ready && !sessionLoading && !bootstrapped.current)),
      label,
      unlock,
      setLockEnabled,
    }),
    [available, enabled, ready, session, sessionLoading, locked, label, unlock, setLockEnabled],
  );

  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>;
}

export function useAppLock() {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error('useAppLock must be used within AppLockProvider');
  return ctx;
}

export function AppLockScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { label, unlock } = useAppLock();
  const { signOut } = useSession();
  const [failed, setFailed] = useState(false);
  const prompted = useRef(false);

  useEffect(() => {
    if (prompted.current) return;
    prompted.current = true;
    void unlock().then((ok) => {
      if (!ok) setFailed(true);
    });
  }, [unlock]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Text style={[styles.brand, { color: colors.text }]}>Reckoner</Text>
      <Text style={[styles.lede, { color: colors.textSecondary }]}>
        {failed ? `Couldn't unlock. Try ${label} again.` : `Unlock with ${label} to continue.`}
      </Text>
      <Pressable
        onPress={() => {
          setFailed(false);
          void unlock().then((ok) => {
            if (!ok) setFailed(true);
          });
        }}
        style={({ pressed }) => [
          styles.primary,
          { backgroundColor: colors.tint, opacity: pressed ? 0.7 : 1 },
        ]}>
        <Text style={styles.primaryLabel}>Unlock</Text>
      </Pressable>
      <Pressable onPress={() => void signOut()} style={styles.signOut}>
        <Text style={{ color: colors.tint, fontWeight: '600' }}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 12 },
  brand: { fontSize: 36, fontWeight: '700', letterSpacing: -0.8, marginBottom: 4 },
  lede: { fontSize: 16, lineHeight: 22, marginBottom: 12 },
  primary: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryLabel: { color: '#fff', fontSize: 16, fontWeight: '600' },
  signOut: { alignItems: 'center', paddingVertical: 12 },
});
