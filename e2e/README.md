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
npx expo run:ios --device   # canonical iOS run (also: npm start / npm run ios)
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

Run-screen playback (read-only): `run-process-audio`, `run-step-audio-*`, `media-play-*`. Playback URI resolution is covered by `tests/definition-audio-playback.test.ts`.

## Library lifecycle

- `archive` — archive hides from library, shows under Archived, unarchive restores
- `delete` — confirm delete removes from live and archived lists

Playwright: `e2e/web/library-lifecycle.spec.ts`  
Maestro: `e2e/maestro/archive.yaml`, `e2e/maestro/delete.yaml`

## Search and pin

- `search` — flat library title filter
- `pin` — pin label + sort above unpinned; unpin clears the label

Playwright: `e2e/web/library-search-pin.spec.ts`  
Maestro: `e2e/maestro/search.yaml`, `e2e/maestro/pin.yaml`

## Includes (sublists) and nested run

- `include` — create two processes, include one as a sublist on a step of the other
- `nested-run` — run the parent; child steps expand inline; checking a child completes the parent step

Playwright: `e2e/web/nested-run.spec.ts` (include + nested run)  
Maestro: `e2e/maestro/include.yaml`, `e2e/maestro/nested-run.yaml`

## Web / iOS parity checklist (v1 success criteria)

Walked against shared Expo Router screens (same UI package). Intentional platform splits are not bugs.

| # | Criterion | Web | iOS | Notes |
|---|-----------|-----|-----|-------|
| 1 | Sign in (email, Google; Apple on iOS) | Yes | Yes | Apple hidden on web (`oauthProvidersForPlatform`). Covered by Playwright smoke + auth gate. |
| 2 | CRUD + search | Yes | Yes | Search E2E on both harnesses. |
| 3 | Live nested include | Yes | Yes | Include + nested-run E2E. |
| 4 | Run / resume / Done | Yes | Yes | Smoke + nested-run. |
| 5 | Definition images / notes / audio | Yes | Yes | Web: Add image (+ audio attach/record where platform allows). iOS: Add image + Camera. Audio E2E skipped (mic). |
| 6 | Offline + sync | Partial | Primary | Web weaker by design (see `.plans/architecture.md`). Not E2E-automated here. |
| 7 | Face ID / biometrics | N/A | Yes | Account shows unavailable on web; toggle only when hardware available. |
| 8 | Same account library | Infra | Infra | Needs real Supabase + PowerSync; not memory-E2E. |
| 9 | Freemium shell | Yes | Yes | Account plan field; entitlement helper. |

### Documented non-automatable / deferred gaps

These stay out of the green CI harness (device, OS, or cloud dependent). Follow-up beads track product work where needed.

| Gap | Why not E2E here | Tracking |
|-----|------------------|----------|
| Definition **audio** E2E | Mic/AV cannot be stubbed in CI; UI + testIDs exist (see “Definition audio” above) | `reckoner-ws6` / play-on-run `reckoner-xer` |
| True offline / sync / cross-device | Requires Supabase + PowerSync + network control | `reckoner-z1f` |
| Face ID unlock path | Needs enrolled biometrics on a device; account lock toggle lacks dedicated testIDs for Maestro | `reckoner-jt4.1` |
| Native camera capture | Simulator/CI has no reliable camera; Camera control is iOS-only | intentional; not a web gap |
| Sign in with Apple | Web intentionally omitted; App Store path | `reckoner-sv9`, `reckoner-1f1` |
| Maestro in GitHub Actions | Needs simulator + app build; CI runs Playwright only | local `npm run test:e2e:maestro`; device verify `reckoner-jt4.3` |
