import type { EntitlementPort } from '@/src/ports/entitlement';

export function createAlwaysFreeEntitlement(): EntitlementPort {
  return {
    async getPlan() {
      return 'free';
    },
  };
}
