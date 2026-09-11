import type { Plan, UserId } from '@/src/domain/types';

/**
 * Freemium entitlement. v1 may always allow; keep checks behind this port.
 */
export interface EntitlementPort {
  getPlan(userId: UserId): Promise<Plan>;
}
