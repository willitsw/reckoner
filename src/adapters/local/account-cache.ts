import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Account, Plan } from '@/src/domain/types';

function key(userId: string) {
  return `reckoner.account.${userId}`;
}

function canStore() {
  return typeof window !== 'undefined';
}

function asPlan(value: unknown): Plan {
  return value === 'paid' ? 'paid' : 'free';
}

function asAccount(value: unknown): Account | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string') return null;
  return {
    id: row.id,
    email: typeof row.email === 'string' ? row.email : null,
    displayName: typeof row.displayName === 'string' ? row.displayName : null,
    plan: asPlan(row.plan),
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : null,
  };
}

/** Last successful profile read, so the account screen works offline. */
export async function readCachedAccount(userId: string): Promise<Account | null> {
  if (!canStore()) return null;
  const raw = await AsyncStorage.getItem(key(userId));
  if (!raw) return null;
  try {
    return asAccount(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function writeCachedAccount(account: Account): Promise<void> {
  if (!canStore()) return;
  await AsyncStorage.setItem(key(account.id), JSON.stringify(account));
}

export async function clearCachedAccount(userId: string): Promise<void> {
  if (!canStore()) return;
  await AsyncStorage.removeItem(key(userId));
}
