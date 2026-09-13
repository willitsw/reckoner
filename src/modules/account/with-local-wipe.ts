import type { AccountPort } from '@/src/ports/account';
import type { ProcessRepository } from '@/src/ports/process-repository';

/** Account delete also drops this device's process copy. Cloud delete stays in the account port. */
export function withLocalWipe(account: AccountPort, processes: ProcessRepository): AccountPort {
  return {
    ...account,
    async deleteAccount() {
      await account.deleteAccount();
      await processes.clearLocal();
    },
  };
}
