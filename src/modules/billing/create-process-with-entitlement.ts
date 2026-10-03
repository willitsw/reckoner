import type { Process } from '@/src/domain/types';
import { assertEntitlement } from '@/src/modules/billing/assert-entitlement';
import type { EntitlementPort } from '@/src/ports/entitlement';
import type { CreateProcessInput, ProcessRepository } from '@/src/ports/process-repository';

/**
 * Natural create-process gate: assert entitlement (no-op allow in v1), then create.
 */
export async function createProcessWithEntitlement(
  entitlements: EntitlementPort,
  processes: ProcessRepository,
  input: CreateProcessInput,
): Promise<Process> {
  const decision = await assertEntitlement(entitlements, input.ownerId, 'create_process');
  if (!decision.allowed) {
    throw new Error('Upgrade to create more processes.');
  }
  return processes.createProcess(input);
}
