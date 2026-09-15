# E2E harness

Rules that differ from the root `AGENTS.md`.

## Scope

- `e2e/web/` — Playwright against Expo web (CI-friendly).
- `e2e/maestro/` — Maestro flows against iOS Simulator / Android emulator / device.
- Prefer user-visible smoke paths. Do not re-test port or pgTAP details here.

## Adapters

- Default E2E runs with **no Supabase env** so the DI root wires memory auth + memory processes.
- Do not mock feature modules. Swap only at the composition root / env boundary.

## Selectors

- Prefer `testID` / `data-testid` from the screens (`sign-in-email`, `library-new-process`, …).
- Shared IDs must stay in sync across Playwright and Maestro flows.

## Commands

```bash
npm run test:e2e:web      # starts Expo web, runs Playwright
npm run test:e2e:maestro # requires Maestro CLI + a running app/simulator
```
