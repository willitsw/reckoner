import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { getContainer } from '@/src/di/container';
import { useSession } from '@/src/modules/auth/session-context';

export default function AccountScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { session, signOut } = useSession();
  const container = getContainer();
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);

  useEffect(() => {
    void container.biometrics.isAvailable().then(setBiometricsAvailable);
  }, [container.biometrics]);

  async function tryBiometricUnlock() {
    await container.biometrics.authenticate();
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Account</Text>
      <Text style={[styles.meta, { color: colors.textSecondary }]}>
        {session?.user.email ?? 'Signed in'}
      </Text>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Backend</Text>
        <Text style={{ color: colors.textSecondary }}>
          {container.supabaseConfigured
            ? 'Supabase env detected (adapters still memory until wired).'
            : 'Using in-memory adapters. Add Supabase keys in `.env` when ready.'}
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Face ID</Text>
        <Text style={{ color: colors.textSecondary, marginBottom: 12 }}>
          {biometricsAvailable
            ? 'Device biometrics available. Unlock gate will wrap the app session later.'
            : 'Biometrics unavailable on this device/platform.'}
        </Text>
        {biometricsAvailable ? (
          <Pressable
            onPress={tryBiometricUnlock}
            style={({ pressed }) => [
              styles.secondaryButton,
              { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}>
            <Text style={{ color: colors.text, fontWeight: '600' }}>Try Face ID</Text>
          </Pressable>
        ) : null}
      </View>

      <Pressable
        onPress={() => void signOut()}
        style={({ pressed }) => [
          styles.signOut,
          { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
        ]}>
        <Text style={{ color: colors.text, fontWeight: '600' }}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, gap: 16 },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  meta: { fontSize: 15, marginTop: -8 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  secondaryButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  signOut: {
    marginTop: 'auto',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
});
