import { createExpoBiometricAdapter } from '@/src/adapters/expo/biometric';
import { createMemoryAccountAdapter } from '@/src/adapters/memory/account';
import { createMemoryAuthAdapter } from '@/src/adapters/memory/auth';
import { createAlwaysFreeEntitlement } from '@/src/adapters/memory/entitlement';
import { createMemoryLibrary } from '@/src/adapters/memory/process-repository';
import { createSupabaseAccountAdapter } from '@/src/adapters/supabase/account';
import { createSupabaseAuthAdapter } from '@/src/adapters/supabase/auth';
import { createSupabaseClient } from '@/src/adapters/supabase/client';
import { withLocalWipe } from '@/src/modules/account/with-local-wipe';
import type { AccountPort } from '@/src/ports/account';
import type { AuthPort } from '@/src/ports/auth';
import type { BiometricPort } from '@/src/ports/biometric';
import type { EntitlementPort } from '@/src/ports/entitlement';
import type { ProcessRepository } from '@/src/ports/process-repository';
import type { RunRepository } from '@/src/ports/run-repository';

export type AppContainer = {
  auth: AuthPort;
  account: AccountPort;
  biometrics: BiometricPort;
  processes: ProcessRepository;
  runs: RunRepository;
  entitlements: EntitlementPort;
  /** True when Supabase env is present. */
  supabaseConfigured: boolean;
};

let container: AppContainer | null = null;

/**
 * Composition root. Auth uses Supabase when env is set; other ports stay memory for now.
 */
export function getContainer(): AppContainer {
  if (container) return container;

  const supabase = createSupabaseClient();
  const auth = supabase ? createSupabaseAuthAdapter(supabase) : createMemoryAuthAdapter();
  const library = createMemoryLibrary();
  const processes = library.processes;
  const account = supabase ? createSupabaseAccountAdapter(supabase) : createMemoryAccountAdapter(auth);

  container = {
    auth,
    account: withLocalWipe(account, processes),
    biometrics: createExpoBiometricAdapter(),
    processes,
    runs: library.runs,
    entitlements: createAlwaysFreeEntitlement(),
    supabaseConfigured: supabase !== null,
  };

  return container;
}

/** Test helper — reset singleton between tests. */
export function resetContainerForTests() {
  container = null;
}
