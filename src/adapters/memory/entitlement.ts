import type { Plan, UserId } from '@/src/domain/types';
import type { EntitlementPort } from '@/src/ports/entitlement';

type MemoryEntitlementOptions = {
  plan?: Plan | ((userId: UserId) => Plan);
};

/**
 * In-memory entitlement. Default production wiring stays always-free;
 * tests can inject `paid` without inventing meters.
 */
export function createMemoryEntitlement(
  options: MemoryEntitlementOptions = {},
): EntitlementPort {
  const plan = options.plan ?? 'free';
  return {
    async getPlan(userId) {
      return typeof plan === 'function' ? plan(userId) : plan;
    },
  };
}

/** App default until purchase / profiles.plan wiring lands. */
export function createAlwaysFreeEntitlement(): EntitlementPort {
  return createMemoryEntitlement({ plan: 'free' });
}
