# Agent guidelines

Terse rules for humans and agents working in this repo. Prefer pointers over essays. Product decisions live in `.plans/` (local; not committed) — do not invent product behavior; check there first when unsure.

## Architecture

- **Ports over vendors.** Application and domain code depend on interfaces (ports), not Supabase, PowerSync, Storage, auth SDKs, or other externals. Adapters implement those ports at the edges.
- **Composition at the boundary.** Wire concrete adapters in one place (app entry / DI). Feature modules import ports, never SDKs.
- **Lift-and-shift ready.** Swapping a vendor should mean new adapters + wiring, not edits across feature code.
- **Offline is a product requirement.** Assume local-first reads/writes; sync and media upload are infrastructure concerns behind ports.

## Testing

- **Prefer behavioral tests:** integration and end-to-end over unit tests with heavy mocks.
- **Mock only true externals** (or replace them with test adapters / local stacks). Do not mock internal modules to make a test pass.
- **Unit-test pure logic** only when it is awkward or expensive to cover through the behavioral path (e.g. cycle checks, ordering, pure transforms).
- **Tests describe user- or system-visible behavior**, not implementation details of adapters.

## Docs & discovery

- Keep this file short. Put deep detail in colocated `README.md` next to the code it describes, or in `.plans/` for product/architecture drafts.
- When you add a port, adapter, or package boundary, note it in the nearest README (or here if it is repo-wide). Do not maintain a parallel agent-only wiki.
- Nested `AGENTS.md` only where a subtree has **different** rules than the root (e.g. generated SQL, E2E harness). Otherwise one root file.

## Working style

- Match existing patterns; do not drive-by refactor.
- Prefer small, focused changes. Ask before expanding scope.
- Do not commit `.plans/` or secrets unless explicitly asked.
