import type {
  CommonPowerSyncDatabase,
  PowerSyncBackendConnector,
  PowerSyncCredentials,
} from '@powersync/common';
import { UpdateType } from '@powersync/common';
import type { SupabaseClient } from '@supabase/supabase-js';

const UPLOAD_TABLES = [
  'profiles',
  'processes',
  'steps',
  'media_assets',
  'runs',
  'run_checks',
] as const;

type UploadTable = (typeof UPLOAD_TABLES)[number];

function isUploadTable(table: string): table is UploadTable {
  return (UPLOAD_TABLES as readonly string[]).includes(table);
}

/**
 * Bridges PowerSync ↔ Supabase Auth JWT + PostgREST CRUD uploads.
 * RLS / triggers remain the server source of truth.
 */
export function createSupabasePowerSyncConnector(options: {
  supabase: SupabaseClient;
  powerSyncUrl: string;
}): PowerSyncBackendConnector {
  const { supabase, powerSyncUrl } = options;

  return {
    async fetchCredentials(): Promise<PowerSyncCredentials> {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      const token = data.session?.access_token;
      if (!token) {
        throw new Error('Sign in before connecting PowerSync.');
      }
      return {
        endpoint: powerSyncUrl,
        token,
      };
    },

    async uploadData(database: CommonPowerSyncDatabase): Promise<void> {
      const batch = await database.getCrudBatch();
      if (!batch) return;

      for (const op of batch.crud) {
        if (!isUploadTable(op.table)) {
          throw new Error(`Unsupported PowerSync upload table: ${op.table}`);
        }

        const table = supabase.from(op.table);
        switch (op.op) {
          case UpdateType.PUT: {
            const record = { ...op.opData, id: op.id };
            const { error } = await table.upsert(record);
            if (error) throw error;
            break;
          }
          case UpdateType.PATCH: {
            const { error } = await table.update(op.opData ?? {}).eq('id', op.id);
            if (error) throw error;
            break;
          }
          case UpdateType.DELETE: {
            const { error } = await table.delete().eq('id', op.id);
            if (error) throw error;
            break;
          }
          default:
            throw new Error(`Unsupported PowerSync op: ${op.op as string}`);
        }
      }

      await batch.complete();
    },
  };
}

/** No-op connector for local-only tests (no cloud). */
export function createNoOpPowerSyncConnector(): PowerSyncBackendConnector {
  return {
    async fetchCredentials() {
      return {
        endpoint: 'https://powersync.local.test',
        token: 'test-token',
      };
    },
    async uploadData() {
      // Local SQLite contract tests never connect; uploads are a no-op.
    },
  };
}
