import type { SupabaseClient } from '@supabase/supabase-js';

import { clearCachedAccount, readCachedAccount, writeCachedAccount } from '@/src/adapters/local/account-cache';
import { normalizeDisplayName } from '@/src/domain/display-name';
import type { Account, Plan } from '@/src/domain/types';
import type { AccountPort } from '@/src/ports/account';

function asPlan(value: unknown): Plan {
  return value === 'paid' ? 'paid' : 'free';
}

/**
 * Reads profiles + the auth user. Falls back to the last cached profile when
 * the network read fails, so the account screen works offline.
 * Delete goes through public.delete_own_account, which only removes auth.uid().
 */
export function createSupabaseAccountAdapter(client: SupabaseClient): AccountPort {
  return {
    async getAccount(): Promise<Account | null> {
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      const user = sessionData.session?.user;
      if (!user) return null;

      try {
        const { data: profile, error: profileError } = await client
          .from('profiles')
          .select('display_name, plan, created_at')
          .eq('id', user.id)
          .maybeSingle();
        if (profileError) throw profileError;

        const account: Account = {
          id: user.id,
          email: user.email ?? null,
          displayName: profile?.display_name ?? null,
          plan: asPlan(profile?.plan),
          createdAt: profile?.created_at ?? user.created_at ?? null,
        };
        await writeCachedAccount(account);
        return account;
      } catch (error) {
        const cached = await readCachedAccount(user.id);
        if (cached) return { ...cached, email: user.email ?? cached.email };
        throw error;
      }
    },

    async updateDisplayName(displayName) {
      const nextName = normalizeDisplayName(displayName);
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      const userId = sessionData.session?.user.id;
      if (!userId) throw new Error('Sign in to update this account.');

      const { error } = await client
        .from('profiles')
        .update({ display_name: nextName })
        .eq('id', userId);
      if (error) throw error;

      const account = await this.getAccount();
      if (!account) throw new Error('Sign in to update this account.');
      return account;
    },

    async deleteAccount() {
      const { data: sessionData } = await client.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (userId) await clearCachedAccount(userId);

      const { error } = await client.rpc('delete_own_account');
      if (error) throw error;
      const { error: signOutError } = await client.auth.signOut({ scope: 'local' });
      if (signOutError) throw signOutError;
    },
  };
}
