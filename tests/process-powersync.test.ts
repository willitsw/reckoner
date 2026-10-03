import { after } from 'node:test';

import { registerProcessRepositoryContract } from './contracts/process-contract';
import { createPowerSyncProcessRepositoryForTests } from './helpers/powersync-test-db';

const openRepos: Array<{ close: () => Promise<void> }> = [];

after(async () => {
  await Promise.all(openRepos.splice(0).map((repo) => repo.close()));
});

registerProcessRepositoryContract('powersync-sqlite', async () => {
  const repo = await createPowerSyncProcessRepositoryForTests();
  openRepos.push(repo);
  return repo;
});
