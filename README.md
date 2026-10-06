# Reckoner

Consumer app for reusable, nestable **Processes** (hobby workflows first). iOS + web via Expo.

Product decisions live in `.plans/` (gitignored). Architecture rules: [`AGENTS.md`](./AGENTS.md).

Marketing and growth planning:

- [`docs/marketing-plan.md`](./docs/marketing-plan.md)
- [`docs/growth-beads.md`](./docs/growth-beads.md)

## Quick start

Requires **Node 18.14+** (22 recommended). This repo has an `.nvmrc`:

```bash
nvm use
npm install
npx expo run:ios --device
```

That is the canonical way to run the iOS app (also available as `npm start` / `npm run ios`). It builds a native binary and launches on a selected simulator or device. Do **not** use `npx expo start` alone for iOS, and do **not** use Expo Go — the App Store client lags the SDK in this repo. After `.env` changes, re-run `npx expo run:ios --device` (or restart that process) so Metro reloads env. For web: `npm run web`.

Sign in with email/password against **Supabase** when `.env` has keys; otherwise memory auth. Copy [`.env.example`](./.env.example) to `.env`. With `EXPO_PUBLIC_POWERSYNC_URL` plus Supabase env, processes and runs use the shared PowerSync/SQLite adapter; otherwise memory (default in CI).

```bash
npm test
npm run typecheck
npm run test:e2e:web
```

`npm test` covers the account port (name, delete, local wipe) through the memory adapters. It also runs on commit (`npm install` installs the hook). Profile isolation and `delete_own_account` are pgTAP tests in `supabase/tests/database/`; run those with `supabase test db` once local Supabase is up.

E2E: Playwright drives Expo web (`npm run test:e2e:web`). Maestro covers native (`npm run test:e2e:maestro` — needs the Maestro CLI + simulator). Details in [`e2e/README.md`](./e2e/README.md).

On push to `main` / `master`, GitHub Actions runs typecheck, unit tests, and Playwright (see [`.github/workflows/tests.yml`](./.github/workflows/tests.yml)).

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
| `e2e/` | Playwright (web) + Maestro (native) smoke harness |

## Next work

Execution queue is **Beads** (not this list). Product intent: [`.plans/v1-scope.md`](.plans/v1-scope.md) (gitignored). Agent rules + TDD: [`AGENTS.md`](./AGENTS.md).

```bash
bd ready              # unblocked work
bd show reckoner-jt4  # v1 MVP milestone
bd show reckoner-c25  # definition images (active trial)
```
