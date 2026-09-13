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

type Mode = 'sign-in' | 'sign-up' | 'forgot';

export default function SignInScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { signInWithPassword, signUpWithPassword, requestPasswordReset } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<Mode>('sign-in');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const needsPassword = mode !== 'forgot';
  const canSubmit = Boolean(email.trim()) && (!needsPassword || Boolean(password)) && !busy;

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  async function onSubmit() {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === 'sign-in') {
        await signInWithPassword(email.trim(), password);
      } else if (mode === 'sign-up') {
        const result = await signUpWithPassword(email.trim(), password);
        if (result.status === 'confirm-email') {
          setPassword('');
          setMode('sign-in');
          setNotice('Check your email to confirm this account, then sign in.');
        }
      } else {
        await requestPasswordReset(email.trim());
        setNotice('If an account exists for that email, we sent a reset link.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  const title = mode === 'forgot' ? 'Reset password' : 'Reckoner';
  const lede =
    mode === 'forgot'
      ? 'We will email a link to choose a new password.'
      : 'Sign in to manage your processes.';
  const submitLabel =
    mode === 'sign-in' ? 'Sign in' : mode === 'sign-up' ? 'Create account' : 'Send reset link';

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.inner}>
        <Text style={[styles.brand, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.lede, { color: colors.textSecondary }]}>{lede}</Text>

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
        {needsPassword ? (
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
        ) : null}

        {notice ? <Text style={[styles.notice, { color: colors.text }]}>{notice}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          onPress={() => void onSubmit()}
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.primary,
            { backgroundColor: colors.tint, opacity: pressed || !canSubmit ? 0.7 : 1 },
          ]}>
          <Text style={styles.primaryLabel}>{busy ? 'Working…' : submitLabel}</Text>
        </Pressable>

        {mode === 'sign-in' ? (
          <Pressable onPress={() => switchMode('forgot')} style={styles.switchMode}>
            <Text style={{ color: colors.tint, fontWeight: '600' }}>Forgot password?</Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => switchMode(mode === 'sign-up' ? 'sign-in' : mode === 'forgot' ? 'sign-in' : 'sign-up')}
          style={styles.switchMode}>
          <Text style={{ color: colors.tint, fontWeight: '600' }}>
            {mode === 'sign-up'
              ? 'Have an account? Sign in'
              : mode === 'forgot'
                ? 'Back to sign in'
                : 'Need an account? Sign up'}
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
  switchMode: { alignItems: 'center', paddingVertical: 8 },
  notice: { fontSize: 14, lineHeight: 20 },
  error: { color: '#B91C1C', fontSize: 14, lineHeight: 20 },
});
