# src/

Application code. Expo Router screens in `/app` stay thin and call into modules + ports.

| Path | Role |
|------|------|
| `domain/` | Pure types and logic (no I/O) |
| `ports/` | Interfaces features depend on |
| `adapters/` | Vendor / infra implementations (`supabase/` = auth, password recovery, account profile; `local/` = offline profile cache; `expo/` = biometric app lock). Processes still memory. Postgres schema lives in `/supabase/migrations/`. |
| `di/` | Composition root — wire adapters once |
| `modules/` | Feature UI helpers and screens' logic |

See root `AGENTS.md`: ports over vendors; mock only externals in tests.
