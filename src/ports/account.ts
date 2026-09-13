import type { Account } from '@/src/domain/types';

/**
 * The signed-in account. Not an admin directory.
 * Implementations: Supabase profile + auth delete, memory stand-in.
 */
export interface AccountPort {
  getAccount(): Promise<Account | null>;
  /** Blank clears the name. Plan and identity are not writable here. */
  updateDisplayName(displayName: string): Promise<Account>;
  /** Permanently removes the signed-in account, then clears the local session. */
  deleteAccount(): Promise<void>;
}
