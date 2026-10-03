import type { AccountPort } from '@/src/ports/account';
import type { AuthPort } from '@/src/ports/auth';
import type { ProcessRepository } from '@/src/ports/process-repository';

type LocalWipeTarget = { clearLocal: () => Promise<void> };

async function wipeLocal(processes: ProcessRepository, extras: LocalWipeTarget[] = []) {
  await processes.clearLocal();
  for (const extra of extras) {
    await extra.clearLocal();
  }
}

/**
 * Account delete also drops this device's library copy (and optional extras
 * such as a media upload queue). Cloud delete stays in the account port.
 */
export function withLocalWipe(
  account: AccountPort,
  processes: ProcessRepository,
  extras: LocalWipeTarget[] = [],
): AccountPort {
  return {
    ...account,
    async deleteAccount() {
      await account.deleteAccount();
      await wipeLocal(processes, extras);
    },
  };
}

/**
 * Sign-out wipes local sync data then clears the session (shared devices:
 * always wipe on logout). PowerSync adapters implement clearLocal as
 * disconnectAndClear on the shared SQLite DB.
 */
export function withSignOutLocalWipe(
  auth: AuthPort,
  processes: ProcessRepository,
  extras: LocalWipeTarget[] = [],
): AuthPort {
  return {
    ...auth,
    async signOut() {
      await wipeLocal(processes, extras);
      await auth.signOut();
    },
  };
}
