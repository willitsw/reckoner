# PowerSync adapters

Local-first SQLite via PowerSync. Feature modules stay on ports; this folder is the vendor edge.

| File | Role |
|------|------|
| `schema.ts` | Shared `AppSchema` (profiles, processes, steps, media_assets, runs, run_checks) |
| `connector.ts` | `fetchCredentials` + `uploadData` (Supabase JWT / PostgREST) |
| `process-repository.ts` | `ProcessRepository` over local PowerSync SQLite |
| `database*.ts` | Platform DB openers (native op-sqlite, web WASQLite) |
| `sync-streams.yaml` | Streams to deploy on the PowerSync instance |

## DI

`getContainer()` selects the PowerSync process adapter when `EXPO_PUBLIC_POWERSYNC_URL` and Supabase env are set; otherwise memory (tests/CI).

## Infra (follow-up)

1. Link Supabase Postgres to a PowerSync project.
2. Publish the six tables above.
3. Deploy `sync-streams.yaml`.

Contract tests use `@powersync/node` + a temp SQLite file (no cloud).
