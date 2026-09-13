# Reckoner

Consumer app for reusable, nestable **Processes** (hobby workflows first). iOS + web via Expo.

Product decisions live in `.plans/` (gitignored). Architecture rules: [`AGENTS.md`](./AGENTS.md).

## Quick start

Requires **Node 18.14+** (22 recommended). This repo has an `.nvmrc`:

```bash
nvm use
npm install
npm run start
```

Then press `i` (iOS simulator), `w` (web), or scan with Expo Go.

Sign in with email/password against **Supabase** when `.env` has keys; otherwise memory auth. Copy [`.env.example`](./.env.example) to `.env`.

```bash
npm test
npm run typecheck
```

`npm test` covers the account port (name, delete, local wipe) through the memory adapters. It also runs on commit (`npm install` installs the hook). Profile isolation and `delete_own_account` are pgTAP tests in `supabase/tests/database/`; run those with `supabase test db` once local Supabase is up.

If Metro crashes with `availableParallelism is not a function`, the process is on an old Node — run `node -v` in that same terminal and `nvm use` (or upgrade Node), then restart.
## Layout

| Path | Purpose |
|------|---------|
| `app/` | Expo Router screens (thin) |
| `src/domain/` | Pure types |
| `src/ports/` | Interfaces |
| `src/adapters/` | Memory / Expo / Supabase implementations |
| `src/di/` | Composition root |
| `src/modules/` | Feature helpers (e.g. session) |
| `supabase/migrations/` | Postgres schema (RLS, includes, runs, media bucket) |

## Next build slices

1. Supabase Auth adapter (email, Google, Apple)
2. PowerSync (schema + RLS are in `supabase/migrations/`)
3. Nesting (live include + cycle guard)
4. Run / checkbox + inline expand
5. Media queue + offline harden
