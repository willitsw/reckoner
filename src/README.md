# src/

Application code. Expo Router screens in `/app` stay thin and call into modules + ports.

| Path | Role |
|------|------|
| `domain/` | Pure types and logic (no I/O) |
| `ports/` | Interfaces features depend on (`processes`, `runs`, `media`) |
| `adapters/` | Vendor / infra implementations (`supabase/` = auth, password recovery, account profile, Storage media upload + `media_assets`; `local/` = offline profile cache; `expo/` = biometric app lock; `memory/` = processes, runs, definition media for unit/CI). Feature modules import ports only. Postgres schema lives in `/supabase/migrations/`. |
| `di/` | Composition root — wire adapters once. App `media` stays memory; `createOnlineMediaRepository` builds the Storage path for the future upload queue. |
| `modules/` | Feature UI helpers and screens' logic (`account/` wipe-on-delete, `process/` step order, include picker, run view) |

See root `AGENTS.md`: ports over vendors; mock only externals in tests. App-level tests live in `/tests` and talk to ports. Database tests live in `/supabase/tests/database`.
