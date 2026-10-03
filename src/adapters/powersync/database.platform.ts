/**
 * Fallback for non-platform resolvers (Node typecheck / tests).
 * Metro resolves `.native.ts` / `.web.ts` instead.
 */
export async function openPlatformPowerSyncDatabase(): Promise<never> {
  throw new Error(
    'openPlatformPowerSyncDatabase requires a platform-specific module (.native / .web).',
  );
}
