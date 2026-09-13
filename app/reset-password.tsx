import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useSession } from '@/src/modules/auth/session-context';

export default function ResetPasswordScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { session, loading, callbackError, updatePassword } = useSession();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = Boolean(password) && password === confirm && !busy;

  async function onSubmit() {
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await updatePassword(password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the password.');
      setBusy(false);
    }
  }

  if (!loading && !session) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.inner}>
          <Text style={[styles.brand, { color: colors.text }]}>Reset password</Text>
          <Text style={[styles.lede, { color: colors.textSecondary }]}>
            {callbackError ?? 'This reset link is invalid or expired. Request a new one and open it on this device.'}
          </Text>
          <Pressable
            onPress={() => router.replace('/sign-in')}
            style={({ pressed }) => [
              styles.primary,
              { backgroundColor: colors.tint, opacity: pressed ? 0.7 : 1 },
            ]}>
            <Text style={styles.primaryLabel}>Back to sign in</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.inner}>
        <Text style={[styles.brand, { color: colors.text }]}>Choose a new password</Text>
        <Text style={[styles.lede, { color: colors.textSecondary }]}>
          This replaces the password on your account.
        </Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="New password"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          textContentType="newPassword"
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
        />
        <TextInput
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Confirm password"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          textContentType="newPassword"
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          onPress={() => void onSubmit()}
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.primary,
            { backgroundColor: colors.tint, opacity: pressed || !canSubmit ? 0.7 : 1 },
          ]}>
          <Text style={styles.primaryLabel}>{busy ? 'Saving…' : 'Update password'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center' },
  inner: { paddingHorizontal: 24, gap: 12 },
  brand: { fontSize: 32, fontWeight: '700', letterSpacing: -0.6, marginBottom: 4 },
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
  error: { color: '#B91C1C', fontSize: 14, lineHeight: 20 },
});
