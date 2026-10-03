import type { Plan, UserId } from '@/src/domain/types';
import type { EntitlementPort } from '@/src/ports/entitlement';

/** Gate actions — meters TBD (#22); listed so call sites share one vocabulary. */
export type EntitlementAction = 'create_process' | 'attach_media';

export type EntitlementDecision = {
  plan: Plan;
  /** Always true in v1; hard limits land here later without inventing meters now. */
  allowed: boolean;
};

/**
 * Single freemium gate. Reads the plan via EntitlementPort.
 * v1 meters are TBD (#22) — always allows; call sites still go through here
 * so limits can land in one place later.
 */
export async function assertEntitlement(
  entitlements: EntitlementPort,
  userId: UserId,
  _action: EntitlementAction,
): Promise<EntitlementDecision> {
  const plan = await entitlements.getPlan(userId);
  return { plan, allowed: true };
}
