# Agent guidelines

Terse rules for humans and agents working in this repo. Prefer pointers over essays. Product decisions live in `.plans/` (local; not committed) — do not invent product behavior; check there first when unsure.

## Architecture

- **Ports over vendors.** Application and domain code depend on interfaces (ports), not Supabase, PowerSync, Storage, auth SDKs, or other externals. Adapters implement those ports at the edges.
- **Composition at the boundary.** Wire concrete adapters in one place (app entry / DI). Feature modules import ports, never SDKs.
- **Lift-and-shift ready.** Swapping a vendor should mean new adapters + wiring, not edits across feature code.
- **Offline is a product requirement.** Assume local-first reads/writes; sync and media upload are infrastructure concerns behind ports.

## Testing

- **TDD by default** for ports, adapters, and domain logic: write a failing behavioral test first, implement until green, then refactor. Claimed beads should land that way unless the harness truly cannot reach the path (note why on the bead).
- **Prefer behavioral tests:** integration and end-to-end over unit tests with heavy mocks. App tests live in `/tests` and talk to ports via memory/test adapters; DB tests in `/supabase/tests/database`; E2E in `/e2e`.
- **Mock only true externals** (or replace them with test adapters / local stacks). Do not mock internal modules to make a test pass.
- **Unit-test pure logic** only when it is awkward or expensive to cover through the behavioral path (e.g. cycle checks, ordering, pure transforms).
- **Tests describe user- or system-visible behavior**, not implementation details of adapters.
- **Every bead that changes behavior** must list Test coverage (and TDD steps when applicable) in its description or acceptance criteria before implementation starts. UI work: port-level tests first, then `testID`s, then Playwright/Maestro when the path is harnessable.

## Docs & discovery

- Keep this file short. Put deep detail in colocated `README.md` next to the code it describes, or in `.plans/` for product/architecture drafts.
- When you add a port, adapter, or package boundary, note it in the nearest README (or here if it is repo-wide). Do not maintain a parallel agent-only wiki.
- Nested `AGENTS.md` only where a subtree has **different** rules than the root (e.g. generated SQL, E2E harness). Otherwise one root file.

## Working style

- Match existing patterns; do not drive-by refactor.
- Prefer small, focused changes. Ask before expanding scope.
- Do not commit `.plans/` or secrets unless explicitly asked.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:1105d646 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/core-concepts/sync-concepts.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->

<!-- BEGIN BEADS CODEX SETUP: generated by bd setup codex -->
## Beads Issue Tracker

Use Beads (`bd`) for durable task tracking in repositories that include it. Use the `beads` skill at `.agents/skills/beads/SKILL.md` (project install) or `~/.agents/skills/beads/SKILL.md` (global install) for Beads workflow guidance, then use the `bd` CLI for issue operations.

### Quick Reference

```bash
bd ready                # Find available work
bd show <id>            # View issue details
bd update <id> --claim  # Claim work
bd close <id>           # Complete work
bd prime                # Refresh Beads context
```

### Rules

- Use `bd` for all task tracking; do not create markdown TODO lists.
- Run `bd prime` when Beads context is missing or stale. Codex 0.129.0+ can load Beads context automatically through native hooks; use `/hooks` to inspect or toggle them.
- Keep persistent project memory in Beads via `bd remember`; do not create ad hoc memory files.

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/core-concepts/sync-concepts.md for details and anti-patterns.
<!-- END BEADS CODEX SETUP -->
