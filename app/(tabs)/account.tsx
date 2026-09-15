import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { getContainer } from '@/src/di/container';
import type { Account } from '@/src/domain/types';
import { useAppLock } from '@/src/modules/auth/app-lock';
import { useSession } from '@/src/modules/auth/session-context';

function planLabel(plan: Account['plan']) {
  return plan === 'paid' ? 'Paid' : 'Free';
}

function formatWhen(iso: string | null) {
  if (!iso) return 'Not available';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function AccountScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { signOut, reauthenticate, updatePassword } = useSession();
  const appLock = useAppLock();
  const container = getContainer();
  const [account, setAccount] = useState<Account | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [nameDirty, setNameDirty] = useState(false);
  const [nameBusy, setNameBusy] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const [lockBusy, setLockBusy] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setAccount(await container.account.getAccount());
    } catch (e) {
      setAccount(null);
      setLoadError(e instanceof Error ? e.message : 'Could not load account details.');
    }
  }, [container.account]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (!nameDirty) setName(account?.displayName ?? '');
  }, [account?.displayName, nameDirty]);

  async function onSaveName() {
    setNameError(null);
    setNameBusy(true);
    try {
      const updated = await container.account.updateDisplayName(name);
      setAccount(updated);
      setName(updated.displayName ?? '');
      setNameDirty(false);
    } catch (e) {
      setNameError(e instanceof Error ? e.message : 'Could not update your name.');
    } finally {
      setNameBusy(false);
    }
  }

  async function onChangePassword() {
    setPasswordError(null);
    setPasswordNotice(null);
    if (nextPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }
    setPasswordBusy(true);
    try {
      await reauthenticate(currentPassword);
      await updatePassword(nextPassword);
      setCurrentPassword('');
      setNextPassword('');
      setConfirmPassword('');
      setPasswordNotice('Password updated.');
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : 'Could not update the password.');
    } finally {
      setPasswordBusy(false);
    }
  }

  async function onToggleLock() {
    setLockError(null);
    setLockBusy(true);
    try {
      await appLock.setLockEnabled(!appLock.enabled);
    } catch (e) {
      setLockError(e instanceof Error ? e.message : 'Could not update the unlock setting.');
    } finally {
      setLockBusy(false);
    }
  }

  async function onDelete() {
    setDeleteError(null);
    setBusy(true);
    try {
      await reauthenticate(deletePassword);
      await container.account.deleteAccount();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Could not delete this account.');
      setBusy(false);
    }
  }

  const passwordReady =
    Boolean(currentPassword) && Boolean(nextPassword) && nextPassword === confirmPassword && !passwordBusy;

  return (
    <ScrollView
      testID="account-screen"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.screen}>
      <Text style={[styles.title, { color: colors.text }]}>Account</Text>

      {loadError ? <Text style={[styles.error, { color: colors.danger }]}>{loadError}</Text> : null}

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Field label="Email" value={account?.email ?? 'Not set'} colors={colors} />
        <View style={[styles.field, { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Name</Text>
          <TextInput
            value={name}
            onChangeText={(value) => {
              setName(value);
              setNameDirty(true);
              setNameError(null);
            }}
            placeholder="Not set"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="words"
            textContentType="name"
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          />
          {nameError ? <Text style={[styles.error, { color: colors.danger }]}>{nameError}</Text> : null}
          {nameDirty ? (
            <Pressable
              onPress={() => void onSaveName()}
              disabled={nameBusy}
              style={({ pressed }) => [
                styles.secondaryButton,
                { borderColor: colors.border, opacity: pressed || nameBusy ? 0.7 : 1 },
              ]}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>{nameBusy ? 'Saving…' : 'Save name'}</Text>
            </Pressable>
          ) : null}
        </View>
        <Field label="Plan" value={account ? planLabel(account.plan) : 'Not available'} colors={colors} />
        <Field label="Member since" value={formatWhen(account?.createdAt ?? null)} colors={colors} />
        <Field label="User ID" value={account?.id ?? 'Not available'} colors={colors} mono last />
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Password</Text>
        <TextInput
          value={currentPassword}
          onChangeText={setCurrentPassword}
          placeholder="Current password"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          textContentType="password"
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
        />
        <TextInput
          value={nextPassword}
          onChangeText={setNextPassword}
          placeholder="New password"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          textContentType="newPassword"
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
        />
        <TextInput
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Confirm new password"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          textContentType="newPassword"
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
        />
        {passwordNotice ? <Text style={{ color: colors.textSecondary }}>{passwordNotice}</Text> : null}
        {passwordError ? <Text style={[styles.error, { color: colors.danger }]}>{passwordError}</Text> : null}
        <Pressable
          onPress={() => void onChangePassword()}
          disabled={!passwordReady}
          style={({ pressed }) => [
            styles.secondaryButton,
            { borderColor: colors.border, opacity: pressed || !passwordReady ? 0.7 : 1 },
          ]}>
          <Text style={{ color: colors.text, fontWeight: '600' }}>
            {passwordBusy ? 'Updating…' : 'Update password'}
          </Text>
        </Pressable>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Backend</Text>
        <Text style={{ color: colors.textSecondary }}>
          {container.supabaseConfigured
            ? 'Auth via Supabase. Processes still use in-memory storage.'
            : 'Using in-memory adapters. Add Supabase keys in `.env` when ready.'}
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          {appLock.available ? appLock.label : 'Face ID'}
        </Text>
        <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>
          {appLock.available
            ? `Ask for ${appLock.label} when you open Reckoner. This does not replace your password.`
            : 'Biometrics unavailable on this device/platform.'}
        </Text>
        {lockError ? <Text style={[styles.error, { color: colors.danger }]}>{lockError}</Text> : null}
        {appLock.available ? (
          <Pressable
            onPress={() => void onToggleLock()}
            disabled={lockBusy}
            style={({ pressed }) => [
              styles.secondaryButton,
              { borderColor: colors.border, opacity: pressed || lockBusy ? 0.7 : 1 },
            ]}>
            <Text style={{ color: colors.text, fontWeight: '600' }}>
              {lockBusy
                ? 'Waiting…'
                : appLock.enabled
                  ? `Turn off ${appLock.label}`
                  : `Turn on ${appLock.label}`}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Delete account</Text>
        <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>
          {confirming
            ? 'Enter your password to permanently delete this account and everything in it — processes, notes, and files. You will be signed out. This cannot be undone.'
            : 'Permanently removes this account and everything in it. This cannot be undone.'}
        </Text>

        {confirming ? (
          <TextInput
            value={deletePassword}
            onChangeText={setDeletePassword}
            placeholder="Password"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            textContentType="password"
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          />
        ) : null}

        {deleteError ? (
          <Text style={[styles.error, { color: colors.danger }]}>{deleteError}</Text>
        ) : null}

        {confirming ? (
          <View style={styles.actions}>
            <Pressable
              onPress={() => void onDelete()}
              disabled={busy || !deletePassword}
              style={({ pressed }) => [
                styles.dangerButton,
                { opacity: pressed || busy || !deletePassword ? 0.7 : 1 },
              ]}>
              <Text style={styles.dangerLabel}>{busy ? 'Deleting…' : 'Delete account'}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setConfirming(false);
                setDeletePassword('');
                setDeleteError(null);
              }}
              disabled={busy}
              style={({ pressed }) => [
                styles.secondaryButton,
                styles.confirmSecondary,
                { borderColor: colors.border, opacity: pressed || busy ? 0.7 : 1 },
              ]}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>Keep account</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => setConfirming(true)}
            style={({ pressed }) => [
              styles.secondaryButton,
              { borderColor: colors.danger, opacity: pressed ? 0.7 : 1 },
            ]}>
            <Text style={{ color: colors.danger, fontWeight: '600' }}>Delete account</Text>
          </Pressable>
        )}
      </View>

      <Pressable
        testID="account-sign-out"
        onPress={() => void signOut()}
        style={({ pressed }) => [
          styles.signOut,
          { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
        ]}>
        <Text style={{ color: colors.text, fontWeight: '600' }}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

function Field({
  label,
  value,
  colors,
  mono,
  last,
}: {
  label: string;
  value: string;
  colors: (typeof Colors)['light'];
  mono?: boolean;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.field,
        !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text selectable style={[styles.fieldValue, { color: colors.text }, mono ? styles.mono : null]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 20, gap: 16, paddingBottom: 32 },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  field: { gap: 2, paddingVertical: 10 },
  fieldLabel: { fontSize: 13, fontWeight: '600' },
  fieldValue: { fontSize: 16, lineHeight: 22 },
  mono: { fontFamily: 'SpaceMono', fontSize: 13, lineHeight: 18 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  actions: { gap: 10, marginTop: 4 },
  dangerButton: {
    backgroundColor: '#B91C1C',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dangerLabel: { color: '#fff', fontWeight: '600' },
  secondaryButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  confirmSecondary: { alignSelf: 'stretch', alignItems: 'center' },
  signOut: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  error: { fontSize: 14, lineHeight: 20 },
});
