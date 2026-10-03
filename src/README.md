# src/

Application code. Expo Router screens in `/app` stay thin and call into modules + ports.

| Path | Role |
|------|------|
| `domain/` | Pure types and logic (no I/O) |
| `ports/` | Interfaces features depend on (`processes`, `runs`, `media`, `mediaUploadQueue`) |
| `adapters/` | Vendor / infra implementations (`supabase/` = auth, password recovery, account profile, Storage media; `powersync/` = offline SQLite sync for processes/runs when env configured; `local/` = offline profile cache; `expo/` = biometric app lock; `memory/` = test/dev doubles including the media upload queue). Feature modules import ports only. Postgres schema lives in `/supabase/migrations/`. |
| `di/` | Composition root — wire adapters once. Processes/runs use PowerSync when configured; app `media` stays memory; `mediaUploadQueue` drains through `createOnlineMediaRepository` when Supabase is set. |
| `modules/` | Feature UI helpers and screens' logic (`account/` wipe-on-delete, `auth/app-lock-gate` = Face ID gate over BiometricPort, `auth/oauth-providers` = which SSO buttons to show, `process/` step order, include picker, run view) |

See root `AGENTS.md`: ports over vendors; mock only externals in tests. App-level tests live in `/tests` and talk to ports. Database tests live in `/supabase/tests/database`.
