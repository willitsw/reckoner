import type { SupabaseClient } from '@supabase/supabase-js';

import { createExpoBiometricAdapter } from '@/src/adapters/expo/biometric';
import { createMemoryAccountAdapter } from '@/src/adapters/memory/account';
import { createMemoryAuthAdapter } from '@/src/adapters/memory/auth';
import { createAlwaysFreeEntitlement } from '@/src/adapters/memory/entitlement';
import { createMemoryLibrary } from '@/src/adapters/memory/process-repository';
import { createSupabaseAccountAdapter } from '@/src/adapters/supabase/account';
import { createSupabaseAuthAdapter } from '@/src/adapters/supabase/auth';
import { createSupabaseClient } from '@/src/adapters/supabase/client';
import {
  createSupabaseStorageMediaRepository,
  readLocalMediaFile,
} from '@/src/adapters/supabase/media-repository';
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
};

let container: AppContainer | null = null;

/**
 * Online Storage + `media_assets` MediaRepository. Ready for the upload queue
 * (reckoner-q4o). Not the app default — features keep using memory/`media`.
 */
export function createOnlineMediaRepository(
  client: SupabaseClient,
  processes: ProcessRepository,
): MediaRepository {
  return createSupabaseStorageMediaRepository(client, {
    processes,
    readLocalFile: readLocalMediaFile,
  });
}

/**
 * Composition root. Auth uses Supabase when env is set; library + media stay
 * memory so unit/CI keep the memory-default DI. Online media is available via
 * {@link createOnlineMediaRepository} when Supabase is configured.
 */
export function getContainer(): AppContainer {
  if (container) return container;

  const supabase = createSupabaseClient();
  const auth = supabase ? createSupabaseAuthAdapter(supabase) : createMemoryAuthAdapter();
  const library = createMemoryLibrary();
  const processes = library.processes;
  const account = supabase ? createSupabaseAccountAdapter(supabase) : createMemoryAccountAdapter(auth);

  // Feature-facing media stays memory. Online Storage path:
  // createOnlineMediaRepository(supabase, processes) — for reckoner-q4o.
  container = {
    auth,
    account: withLocalWipe(account, processes),
    biometrics: createExpoBiometricAdapter(),
    processes,
    runs: library.runs,
    media: library.media,
    entitlements: createAlwaysFreeEntitlement(),
    supabaseConfigured: supabase !== null,
  };

  return container;
}

/** Test helper — reset singleton between tests. */
export function resetContainerForTests() {
  container = null;
}
