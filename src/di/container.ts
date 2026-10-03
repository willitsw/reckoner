import { createExpoBiometricAdapter } from '@/src/adapters/expo/biometric';
import { createMemoryAccountAdapter } from '@/src/adapters/memory/account';
import { createMemoryAuthAdapter } from '@/src/adapters/memory/auth';
import { createAlwaysFreeEntitlement } from '@/src/adapters/memory/entitlement';
import { createMemoryLibrary } from '@/src/adapters/memory/process-repository';
import {
  createPowerSyncProcessRepository,
  createSupabasePowerSyncConnector,
  isPowerSyncConfigured,
  openAppPowerSyncDatabase,
} from '@/src/adapters/powersync';
import { createSupabaseAccountAdapter } from '@/src/adapters/supabase/account';
import { createSupabaseAuthAdapter } from '@/src/adapters/supabase/auth';
import { createSupabaseClient } from '@/src/adapters/supabase/client';
import { withLocalWipe } from '@/src/modules/account/with-local-wipe';
import type { AccountPort } from '@/src/ports/account';
import type { AuthPort } from '@/src/ports/auth';
import type { BiometricPort } from '@/src/ports/biometric';
import type { EntitlementPort } from '@/src/ports/entitlement';
import type { MediaRepository } from '@/src/ports/media-repository';
import type { ProcessRepository } from '@/src/ports/process-repository';
import type { RunRepository } from '@/src/ports/run-repository';

export type AppContainer = {
  auth: AuthPort;
  account: AccountPort;
  biometrics: BiometricPort;
  processes: ProcessRepository;
  runs: RunRepository;
  media: MediaRepository;
  entitlements: EntitlementPort;
  /** True when Supabase env is present. */
  supabaseConfigured: boolean;
  /** True when PowerSync + Supabase env select the sync process adapter. */
  powerSyncConfigured: boolean;
};

let container: AppContainer | null = null;

/**
 * Composition root. Auth uses Supabase when env is set.
 * Processes use PowerSync when PowerSync URL + Supabase are configured; else memory.
 * Runs/media stay memory until their adapter beads land (shared AppSchema already includes their tables).
 */
export function getContainer(): AppContainer {
  if (container) return container;

  const supabase = createSupabaseClient();
  const auth = supabase ? createSupabaseAuthAdapter(supabase) : createMemoryAuthAdapter();
  const library = createMemoryLibrary();
  const powerSyncConfigured = Boolean(supabase && isPowerSyncConfigured());

  let processes: ProcessRepository = library.processes;
  if (powerSyncConfigured && supabase) {
    const powerSyncUrl = process.env.EXPO_PUBLIC_POWERSYNC_URL!;
    const connector = createSupabasePowerSyncConnector({ supabase, powerSyncUrl });
    processes = createPowerSyncProcessRepository({
      openDb: async () => {
        const db = await openAppPowerSyncDatabase();
        await db.connect(connector);
        return db;
      },
    });
  }

  const account = supabase ? createSupabaseAccountAdapter(supabase) : createMemoryAccountAdapter(auth);

  container = {
    auth,
    account: withLocalWipe(account, processes),
    biometrics: createExpoBiometricAdapter(),
    processes,
    runs: library.runs,
    media: library.media,
    entitlements: createAlwaysFreeEntitlement(),
    supabaseConfigured: supabase !== null,
    powerSyncConfigured,
  };

  return container;
}

/** Test helper — reset singleton between tests. */
export function resetContainerForTests() {
  container = null;
}
