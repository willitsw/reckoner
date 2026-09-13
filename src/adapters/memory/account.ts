import { normalizeDisplayName } from '@/src/domain/display-name';
import type { Account } from '@/src/domain/types';
import type { AccountPort } from '@/src/ports/account';
import type { AuthPort } from '@/src/ports/auth';

/**
 * Local stand-in when Supabase is not configured.
 * There is no server user to remove, so delete clears the session.
 */
export function createMemoryAccountAdapter(auth: AuthPort): AccountPort {
  let displayName: string | null = null;

  async function current(): Promise<Account | null> {
    const session = await auth.getSession();
    if (!session) return null;
    return {
      id: session.user.id,
      email: session.user.email,
      displayName,
      plan: 'free',
      createdAt: null,
    };
  }

  return {
    getAccount: current,

    async updateDisplayName(next) {
      const session = await auth.getSession();
      if (!session) throw new Error('Sign in to update this account.');
      displayName = normalizeDisplayName(next);
      const account = await current();
      if (!account) throw new Error('Sign in to update this account.');
      return account;
    },

    async deleteAccount() {
      displayName = null;
      await auth.signOut();
    },
  };
}
