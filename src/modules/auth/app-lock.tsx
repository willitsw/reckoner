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
import {
  createAppLockGate,
  type AppLockSnapshot,
} from '@/src/modules/auth/app-lock-gate';
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

const idleSnapshot: AppLockSnapshot = {
  available: false,
  enabled: false,
  ready: false,
  locked: false,
  label: 'Face ID',
};

export function AppLockProvider({ children }: { children: ReactNode }) {
  const { session, loading: sessionLoading } = useSession();
  const gate = useMemo(() => createAppLockGate(getContainer().biometrics), []);
  const [snap, setSnap] = useState<AppLockSnapshot>(idleSnapshot);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || sessionLoading) return;
    started.current = true;
    void gate.bootstrap({ hasSession: Boolean(session) }).then(setSnap);
  }, [gate, session, sessionLoading]);

  useEffect(() => {
    if (!snap.ready || sessionLoading) return;
    setSnap(gate.setHasSession(Boolean(session)));
  }, [session, sessionLoading, gate, snap.ready]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'background') return;
      setSnap(gate.lockForBackground({ hasSession: Boolean(session) }));
    });
    return () => sub.remove();
  }, [gate, session]);

  const unlock = useCallback(async () => {
    const ok = await gate.unlock();
    setSnap(gate.getState({ hasSession: Boolean(session) }));
    return ok;
  }, [gate, session]);

  const setLockEnabled = useCallback(
    async (enabled: boolean) => {
      const ok = await gate.setLockEnabled(enabled);
      setSnap(gate.getState({ hasSession: Boolean(session) }));
      return ok;
    },
    [gate, session],
  );

  const value = useMemo<AppLockContextValue>(
    () => ({
      available: snap.available,
      enabled: snap.enabled,
      ready: snap.ready,
      locked: snap.locked,
      label: snap.label,
      unlock,
      setLockEnabled,
    }),
    [snap, unlock, setLockEnabled],
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
