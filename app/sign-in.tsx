import FontAwesome from '@expo/vector-icons/FontAwesome';
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
import { DEMO_EMAIL, DEMO_PASSWORD } from '@/src/dev/demo-credentials';
import { oauthProvidersForPlatform } from '@/src/modules/auth/oauth-providers';
import { useSession } from '@/src/modules/auth/session-context';
import type { OAuthProvider } from '@/src/ports/auth';

type Mode = 'sign-in' | 'sign-up' | 'forgot';

const PROVIDER_LABELS: Record<OAuthProvider, string> = {
  google: 'Continue with Google',
  apple: 'Continue with Apple',
};

const PROVIDER_ICONS: Record<OAuthProvider, 'google' | 'apple'> = {
  google: 'google',
  apple: 'apple',
};

export default function SignInScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const {
    signInWithPassword,
    signUpWithPassword,
    signInWithProvider,
    requestPasswordReset,
    callbackError,
  } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<Mode>('sign-in');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const oauthProviders = mode === 'sign-in' ? oauthProvidersForPlatform(Platform.OS) : [];

  function useDemoAccount() {
    setMode('sign-in');
    setError(null);
    setNotice(null);
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
  }

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

  async function onProvider(provider: OAuthProvider) {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const result = await signInWithProvider(provider);
      if (result.status === 'error') {
        setError(result.message);
      }
      // cancelled: leave the form as-is; signed-in updates session via AuthPort.
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
      <View testID="sign-in-screen" style={styles.inner}>
        <Text style={[styles.brand, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.lede, { color: colors.textSecondary }]}>{lede}</Text>

        {oauthProviders.length > 0 ? (
          <View style={styles.oauthBlock}>
            {oauthProviders.map((provider) => (
              <Pressable
                key={provider}
                testID={`sign-in-${provider}`}
                onPress={() => void onProvider(provider)}
                disabled={busy}
                style={({ pressed }) => [
                  styles.secondary,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: pressed || busy ? 0.7 : 1,
                  },
                ]}>
                <View style={styles.secondaryContent}>
                  <FontAwesome
                    name={PROVIDER_ICONS[provider]}
                    size={18}
                    color={colors.text}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                  <Text style={[styles.secondaryLabel, { color: colors.text }]}>
                    {PROVIDER_LABELS[provider]}
                  </Text>
                </View>
              </Pressable>
            ))}
            <Text style={[styles.divider, { color: colors.textSecondary }]}>or use email</Text>
          </View>
        ) : null}

        <TextInput
          testID="sign-in-email"
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          // Dev/Maestro: avoid iOS "Save Password?" which blocks automation.
          textContentType={__DEV__ ? 'none' : 'emailAddress'}
          autoComplete={__DEV__ ? 'off' : 'email'}
          importantForAutofill={__DEV__ ? 'no' : 'yes'}
          style={[
            styles.input,
            { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
          ]}
        />
        {needsPassword ? (
          <TextInput
            testID="sign-in-password"
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            textContentType={
              __DEV__ ? 'none' : mode === 'sign-up' ? 'newPassword' : 'password'
            }
            autoComplete={__DEV__ ? 'off' : mode === 'sign-up' ? 'new-password' : 'password'}
            importantForAutofill={__DEV__ ? 'no' : 'yes'}
            style={[
              styles.input,
              { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
            ]}
          />
        ) : null}

        {notice ? <Text style={[styles.notice, { color: colors.text }]}>{notice}</Text> : null}
        {error || callbackError ? (
          <Text testID="sign-in-error" style={styles.error}>
            {error ?? callbackError}
          </Text>
        ) : null}

        <Pressable
          testID="sign-in-submit"
          onPress={() => void onSubmit()}
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.primary,
            { backgroundColor: colors.tint, opacity: pressed || !canSubmit ? 0.7 : 1 },
          ]}>
          <Text style={styles.primaryLabel}>{busy ? 'Working…' : submitLabel}</Text>
        </Pressable>

        {mode === 'sign-in' ? (
          <Pressable
            testID="sign-in-forgot"
            onPress={() => switchMode('forgot')}
            style={styles.switchMode}>
            <Text style={{ color: colors.tint, fontWeight: '600' }}>Forgot password?</Text>
          </Pressable>
        ) : null}

        <Pressable
          testID="sign-in-switch-mode"
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

        {__DEV__ ? (
          <Pressable onPress={useDemoAccount} style={styles.switchMode}>
            <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Use demo account</Text>
          </Pressable>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center' },
  inner: { paddingHorizontal: 24, gap: 12 },
  brand: { fontSize: 36, fontWeight: '700', letterSpacing: -0.8, marginBottom: 4 },
  lede: { fontSize: 16, lineHeight: 22, marginBottom: 12 },
  oauthBlock: { gap: 10, marginBottom: 4 },
  divider: { textAlign: 'center', fontSize: 13, marginTop: 4 },
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
  secondary: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  secondaryLabel: { fontSize: 16, fontWeight: '600' },
  switchMode: { alignItems: 'center', paddingVertical: 8 },
  notice: { fontSize: 14, lineHeight: 20 },
  error: { color: '#B91C1C', fontSize: 14, lineHeight: 20 },
});
