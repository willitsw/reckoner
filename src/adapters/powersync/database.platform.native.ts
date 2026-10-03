import { PowerSyncDatabase } from '@powersync/react-native';
import type { CommonPowerSyncDatabase } from '@powersync/common';

import { AppSchema } from './schema';

export async function openPlatformPowerSyncDatabase(): Promise<CommonPowerSyncDatabase> {
  const db = new PowerSyncDatabase({
    schema: AppSchema,
    database: {
      dbFilename: 'reckoner.db',
    },
  });
  await db.init();
  return db;
}
