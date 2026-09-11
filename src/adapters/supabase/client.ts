import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Shared Supabase client. Returns null until env is configured.
 * Feature code should not import this — only adapters / DI.
 */
export function createSupabaseClient(): SupabaseClient | null {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey);
}
