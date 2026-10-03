import type { AccountPort } from '@/src/ports/account';
import type { ProcessRepository } from '@/src/ports/process-repository';

type LocalWipeTarget = { clearLocal: () => Promise<void> };

/**
 * Account delete also drops this device's process copy (and optional extras
 * such as the media upload queue). Cloud delete stays in the account port.
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
      await processes.clearLocal();
      for (const extra of extras) {
        await extra.clearLocal();
      }
    },
  };
}
