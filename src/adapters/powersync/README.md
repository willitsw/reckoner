# PowerSync adapters

Local-first SQLite via PowerSync. Feature modules stay on ports; this folder is the vendor edge.

| File | Role |
|------|------|
| `schema.ts` | Shared `AppSchema` (profiles, processes, steps, media_assets, runs, run_checks) |
| `connector.ts` | `fetchCredentials` + `uploadData` (Supabase JWT / PostgREST) |
| `process-repository.ts` | `ProcessRepository` over local PowerSync SQLite |
| `run-repository.ts` | `RunRepository` over the same DB |
| `apply-pulled-process.ts` | App-level LWW apply for a pulled `processes` row (`updated_at`) |
| `database*.ts` | Platform DB openers (native op-sqlite, web WASQLite) |
| `sync-streams.yaml` | Streams to deploy on the PowerSync instance |

## Conflict policy (LWW)

v1 is **last-write-wins** by client-set `updated_at` (ISO text). Domain helpers: `src/domain/lww.ts` (`decideLww`, `winsByUpdatedAt`). Equal timestamps keep local.

- Live sync: PowerSync’s op clock merges rows; adapters always stamp `updated_at` on local writes.
- App-level / tests: `applyPulledProcess` applies a fake or observed pull only when remote `updated_at` is strictly newer; repository reads then reflect that row.
- **Updated-elsewhere toast:** deferred — process/run editors reload on focus only; no live row watch or toast surface yet. Suggested copy: `UPDATED_ELSEWHERE_NOTICE` in `src/domain/lww.ts`.

## DI

`getContainer()` selects the PowerSync process adapter when `EXPO_PUBLIC_POWERSYNC_URL` and Supabase env are set; otherwise memory (tests/CI).

## Infra (follow-up)

1. Link Supabase Postgres to a PowerSync project.
2. Publish the six tables above.
3. Deploy `sync-streams.yaml`.

Contract tests use `@powersync/node` + a temp SQLite file (no cloud). LWW behavioral tests: `tests/lww-powersync.test.ts`.
