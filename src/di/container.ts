import type { SupabaseClient } from '@supabase/supabase-js';

import { createExpoBiometricAdapter } from '@/src/adapters/expo/biometric';
import { createMemoryAccountAdapter } from '@/src/adapters/memory/account';
import { createMemoryAuthAdapter } from '@/src/adapters/memory/auth';
import { createAlwaysFreeEntitlement } from '@/src/adapters/memory/entitlement';
import { createMemoryMediaUploadQueue } from '@/src/adapters/memory/media-upload-queue';
import { createMemoryLibrary } from '@/src/adapters/memory/process-repository';
import {
  createPowerSyncLibrary,
  createSupabasePowerSyncConnector,
  isPowerSyncConfigured,
  openAppPowerSyncDatabase,
} from '@/src/adapters/powersync';
import { createSupabaseAccountAdapter } from '@/src/adapters/supabase/account';
import { createSupabaseAuthAdapter } from '@/src/adapters/supabase/auth';
import { createSupabaseClient } from '@/src/adapters/supabase/client';
import {
  createSupabaseStorageMediaRepository,
  readLocalMediaFile,
} from '@/src/adapters/supabase/media-repository';
import { withLocalWipe, withSignOutLocalWipe } from '@/src/modules/account/with-local-wipe';
import type { AccountPort } from '@/src/ports/account';
import type { AuthPort } from '@/src/ports/auth';
import type { BiometricPort } from '@/src/ports/biometric';
import type { EntitlementPort } from '@/src/ports/entitlement';
import type { MediaRepository } from '@/src/ports/media-repository';
import type { MediaUploadQueue } from '@/src/ports/media-upload-queue';
import type { ProcessRepository } from '@/src/ports/process-repository';
import type { RunRepository } from '@/src/ports/run-repository';

export type AppContainer = {
  auth: AuthPort;
  account: AccountPort;
  biometrics: BiometricPort;
  processes: ProcessRepository;
  runs: RunRepository;
  media: MediaRepository;
  /** Device-local pending uploads; drain uses online MediaRepository when configured. */
  mediaUploadQueue: MediaUploadQueue;
  entitlements: EntitlementPort;
  /** True when Supabase env is present. */
  supabaseConfigured: boolean;
  /** True when PowerSync + Supabase env select the sync process/run adapters. */
  powerSyncConfigured: boolean;
};

let container: AppContainer | null = null;

/**
 * Online Storage + `media_assets` MediaRepository. Used by the upload queue
 * drain path. Not the app default for listing — features keep using memory/`media`
 * until PowerSync media rows land; capture should enqueue then drain.
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
 * Composition root. Auth uses Supabase when env is set.
 * Processes + runs use PowerSync when PowerSync URL + Supabase are configured; else memory.
 * Media stays memory until synced media lands (shared AppSchema already includes the table).
 * Upload queue drains through {@link createOnlineMediaRepository} when Supabase is configured;
 * otherwise drain targets the memory media adapter (CI / offline-dev).
 * Sign-out and account delete both wipe local library (PowerSync disconnectAndClear) and the queue.
 */
export function getContainer(): AppContainer {
  if (container) return container;

  const supabase = createSupabaseClient();
  const auth = supabase ? createSupabaseAuthAdapter(supabase) : createMemoryAuthAdapter();
  const memory = createMemoryLibrary();
  const powerSyncConfigured = Boolean(supabase && isPowerSyncConfigured());

  let processes: ProcessRepository = memory.processes;
  let runs: RunRepository = memory.runs;
  if (powerSyncConfigured && supabase) {
    const powerSyncUrl = process.env.EXPO_PUBLIC_POWERSYNC_URL!;
    const connector = createSupabasePowerSyncConnector({ supabase, powerSyncUrl });
    const syncLibrary = createPowerSyncLibrary({
      openDb: async () => {
        const db = await openAppPowerSyncDatabase();
        await db.connect(connector);
        return db;
      },
    });
    processes = syncLibrary.processes;
    runs = syncLibrary.runs;
  }

  const account = supabase ? createSupabaseAccountAdapter(supabase) : createMemoryAccountAdapter(auth);

  // Feature-facing media stays memory for list/UI until synced media lands.
  // Queue drain uses the online Storage+row path when Supabase is configured.
  const uploadMedia: MediaRepository =
    supabase !== null ? createOnlineMediaRepository(supabase, processes) : memory.media;
  const mediaUploadQueue = createMemoryMediaUploadQueue({
    media: uploadMedia,
    // Navigator is unavailable in some RN/Node contexts; default online and let
    // Storage failures drive retry/backoff. UI bead can inject a sharper signal.
    isOnline: () => {
      if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
        return navigator.onLine;
      }
      return true;
    },
  });

  const wipeExtras = [mediaUploadQueue];

  container = {
    auth: withSignOutLocalWipe(auth, processes, wipeExtras),
    account: withLocalWipe(account, processes, wipeExtras),
    biometrics: createExpoBiometricAdapter(),
    processes,
    runs,
    media: memory.media,
    mediaUploadQueue,
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
