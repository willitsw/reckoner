# End-to-end tests

Two harnesses cover the same smoke paths:

| Harness | Target | Entry |
|---------|--------|-------|
| Playwright | Expo web | `e2e/web/` |
| Maestro | iOS / Android | `e2e/maestro/` |

Both assume **memory adapters** (leave `EXPO_PUBLIC_SUPABASE_*` unset).

## Playwright (web)

```bash
npm run test:e2e:web
```

Starts Expo on `http://127.0.0.1:8081`, then runs Chromium. Use `npm run test:e2e:web:ui` for the Playwright UI.

## Maestro (native)

Install the [Maestro CLI](https://maestro.mobile.dev/), start the app (Expo Go or a dev build), then:

```bash
# Expo Go on iOS Simulator (default app id)
npm run test:e2e:maestro

# Dev / release build
MAESTRO_APP_ID=com.reckoner.app npm run test:e2e:maestro
```

Entry flow: `e2e/maestro/smoke.yaml` (shared steps in `e2e/maestro/flows/`). With Expo Go, start Metro (`npm start`) and open the project in the simulator before running Maestro.

## Smoke coverage

1. Sign in → library
2. Create process → rename → add step
3. Run → check a step → sign out
