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

Sign in with any email/password — **memory auth** until Supabase is wired. Copy [`.env.example`](./.env.example) to `.env` when you have a project.

```bash
npm run typecheck
```

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

## Next build slices

1. Supabase Auth adapter (email, Google, Apple)
2. Postgres schema + RLS + PowerSync
3. Nesting (live include + cycle guard)
4. Run / checkbox + inline expand
5. Media queue + offline harden
