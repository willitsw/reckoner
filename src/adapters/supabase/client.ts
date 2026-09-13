import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupportedStorage, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

/**
 * AsyncStorage's web impl touches `window`/`localStorage`. Expo static web
 * SSR runs in Node, so guard before any storage access.
 */
const authStorage: SupportedStorage = {
  getItem: (key) => {
    if (typeof window === 'undefined') return Promise.resolve(null);
    return AsyncStorage.getItem(key);
  },
  setItem: (key, value) => {
    if (typeof window === 'undefined') return Promise.resolve();
    return AsyncStorage.setItem(key, value);
  },
  removeItem: (key) => {
    if (typeof window === 'undefined') return Promise.resolve();
    return AsyncStorage.removeItem(key);
  },
};

/**
 * Shared Supabase client. Returns null until env is configured.
 * Feature code should not import this — only adapters / DI.
 */
export function createSupabaseClient(): SupabaseClient | null {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const isBrowser = typeof window !== 'undefined';

  return createClient(url, anonKey, {
    auth: {
      storage: authStorage,
      autoRefreshToken: isBrowser,
      persistSession: isBrowser,
      detectSessionInUrl: Platform.OS === 'web' && isBrowser,
      // Email links must work on a device that did not start the request.
      // PKCE keeps a verifier on the requesting device and breaks that.
      flowType: 'implicit',
    },
  });
}
