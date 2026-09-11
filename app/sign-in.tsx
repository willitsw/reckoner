import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useSession } from '@/src/modules/auth/session-context';

export default function SignInScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { signInWithPassword, signUpWithPassword } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setError(null);
    setBusy(true);
    try {
      if (mode === 'sign-in') {
        await signInWithPassword(email.trim(), password);
      } else {
        await signUpWithPassword(email.trim(), password);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.inner}>
        <Text style={[styles.brand, { color: colors.text }]}>Reckoner</Text>
        <Text style={[styles.lede, { color: colors.textSecondary }]}>
          Sign in to manage your processes. Local memory auth for now — Supabase next.
        </Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          style={[
            styles.input,
            { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
          ]}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          textContentType={mode === 'sign-up' ? 'newPassword' : 'password'}
          style={[
            styles.input,
            { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
          ]}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          onPress={onSubmit}
          disabled={busy || !email.trim() || !password}
          style={({ pressed }) => [
            styles.primary,
            {
              backgroundColor: colors.tint,
              opacity: pressed || busy || !email.trim() || !password ? 0.7 : 1,
            },
          ]}>
          <Text style={styles.primaryLabel}>
            {busy ? 'Working…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
          style={styles.switchMode}>
          <Text style={{ color: colors.tint, fontWeight: '600' }}>
            {mode === 'sign-in' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center' },
  inner: { paddingHorizontal: 24, gap: 12 },
  brand: { fontSize: 36, fontWeight: '700', letterSpacing: -0.8, marginBottom: 4 },
  lede: { fontSize: 16, lineHeight: 22, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
  },
  primary: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryLabel: { color: '#fff', fontSize: 16, fontWeight: '600' },
  switchMode: { alignItems: 'center', paddingVertical: 12 },
  error: { color: '#B91C1C', fontSize: 14 },
});
