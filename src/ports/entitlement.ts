import type { Plan, UserId } from '@/src/domain/types';

/**
 * Freemium entitlement. App default is always-free; gate via
 * `assertEntitlement` / `createProcessWithEntitlement` (modules/billing).
 * Meters TBD — do not invent hard limits here.
 */
export interface EntitlementPort {
  getPlan(userId: UserId): Promise<Plan>;
}
