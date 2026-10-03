import type { CommonPowerSyncDatabase } from '@powersync/common';

/**
 * Open the app PowerSync DB for the current platform.
 * Native: `@powersync/react-native` + op-sqlite.
 * Web: `@powersync/web` (lazy).
 */
export async function openAppPowerSyncDatabase(): Promise<CommonPowerSyncDatabase> {
  const { openPlatformPowerSyncDatabase } = await import('./database.platform');
  return openPlatformPowerSyncDatabase();
}

export function isPowerSyncConfigured(): boolean {
  const url = process.env.EXPO_PUBLIC_POWERSYNC_URL;
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && supabaseUrl && anonKey);
}
