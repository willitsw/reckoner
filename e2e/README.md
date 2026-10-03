# End-to-end tests

Two harnesses cover the same smoke paths:

| Harness | Target | Entry |
|---------|--------|-------|
| Playwright | Expo web | `e2e/web/` |
| Maestro | iOS / Android | `e2e/maestro/` |

Playwright assumes **memory** auth (it clears `EXPO_PUBLIC_SUPABASE_*` when starting Expo web). Maestro uses the demo Supabase user on a normal device build, or memory auth if you built with `npm run ios:maestro`.

## Playwright (web)

```bash
npm run test:e2e:web
```

Starts Expo on `http://127.0.0.1:8081`, then runs Chromium. Use `npm run test:e2e:web:ui` for the Playwright UI.

CI runs the same command on push to `main` / `master` (`.github/workflows/tests.yml`), after `npx playwright install --with-deps chromium`.

## Maestro (native)

Install the [Maestro CLI](https://maestro.mobile.dev/).

With a normal device build (Supabase from `.env`), seed the demo login first, then run:

```bash
npm run seed:dev
npm start   # or: npm run ios
npm run test:e2e:maestro
```

Maestro signs in as `dev@reckoner.local` / `reckoner-dev-1` (see `src/dev/demo-credentials.ts`).

To force memory auth instead (no Supabase user needed), build with `npm run ios:maestro` then run the Maestro script.

Default app id is `com.reckoner.app`. Entry flow: `e2e/maestro/smoke.yaml` (shared steps in `e2e/maestro/flows/`).

## Smoke coverage

1. Sign in → library
2. Create process → rename → add step
3. Run → check a step → Done → sign out

## Definition audio (skipped)

Maestro/Playwright smoke for record/attach is skipped: Expo AV recording needs a real mic and cannot be stubbed in the current harness. Editor testIDs: `process-attach-audio`, `process-record-audio`, `process-audio`, `step-attach-audio-*`, `step-record-audio-*`, `step-audio-*`, plus shared `media-row-*` / `media-caption-*` / `media-remove-*`.

## Library lifecycle

- `archive` — archive hides from library, shows under Archived, unarchive restores
- `delete` — confirm delete removes from live and archived lists

Playwright: `e2e/web/library-lifecycle.spec.ts`  
Maestro: `e2e/maestro/archive.yaml`, `e2e/maestro/delete.yaml`

## Includes (sublists)

- `include` — create two processes, include one as a sublist on a step of the other

Maestro: `e2e/maestro/include.yaml`
