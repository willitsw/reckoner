import { createExpoBiometricAdapter } from '@/src/adapters/expo/biometric';
import { createMemoryAuthAdapter } from '@/src/adapters/memory/auth';
import { createAlwaysFreeEntitlement } from '@/src/adapters/memory/entitlement';
import { createMemoryProcessRepository } from '@/src/adapters/memory/process-repository';
import { createSupabaseClient } from '@/src/adapters/supabase/client';
import type { AuthPort } from '@/src/ports/auth';
import type { BiometricPort } from '@/src/ports/biometric';
import type { EntitlementPort } from '@/src/ports/entitlement';
import type { ProcessRepository } from '@/src/ports/process-repository';

export type AppContainer = {
  auth: AuthPort;
  biometrics: BiometricPort;
  processes: ProcessRepository;
  entitlements: EntitlementPort;
  /** True when Supabase env is present (real backend not fully wired yet). */
  supabaseConfigured: boolean;
};

let container: AppContainer | null = null;

/**
 * Composition root. Swap memory adapters for Supabase/PowerSync here later.
 */
export function getContainer(): AppContainer {
  if (container) return container;

  const supabase = createSupabaseClient();

  container = {
    auth: createMemoryAuthAdapter(),
    biometrics: createExpoBiometricAdapter(),
    processes: createMemoryProcessRepository(),
    entitlements: createAlwaysFreeEntitlement(),
    supabaseConfigured: supabase !== null,
  };

  return container;
}

/** Test helper — reset singleton between tests. */
export function resetContainerForTests() {
  container = null;
}
