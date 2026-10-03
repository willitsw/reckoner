# Growth and metrics beads

This document captures actionable growth work as small, backlog-ready beads. The
metric-tracking beads should follow the repo architecture rule: product code
depends on a tracking port, and analytics vendors live behind adapters at the
edge.

## Metric-tracking beads

### METRICS-001: Define the analytics event taxonomy

**Goal:** Decide the first set of product and growth events before adding any
analytics vendor.

**Scope:**

- Define event names, required properties, and privacy rules.
- Keep event names tied to user-visible behavior, not implementation details.
- Document which events are allowed before sign-in and which require an account.

**Initial events:**

- `landing_signup_submitted`
- `landing_signup_completed`
- `app_signed_in`
- `process_created`
- `process_step_created`
- `process_included`
- `run_opened`
- `run_step_checked`
- `run_completed`
- `run_started_again`
- `template_viewed`
- `template_imported`

**Acceptance criteria:**

- Event list is documented with descriptions and required properties.
- No event includes checklist body text, notes, URLs, or other user-authored
  content.
- Events can answer the early marketing questions from
  [`marketing-plan.md`](./marketing-plan.md#early-metrics).

### METRICS-002: Add an analytics port and no-op adapter

**Goal:** Make tracking available without coupling screens or modules to a
vendor SDK.

**Scope:**

- Add an `AnalyticsPort` interface under `src/ports/`.
- Add a no-op or console adapter for local development.
- Wire the adapter in the DI container.
- Expose a small helper for typed event calls if it reduces duplicate property
  handling.

**Acceptance criteria:**

- App code imports the port/helper only, not a vendor SDK.
- Tests can run without network access or analytics credentials.
- Local development does not send production analytics.

### METRICS-003: Instrument activation events

**Goal:** Track the first-use path from account entry to first useful process.

**Scope:**

- Track sign-in completion.
- Track process creation.
- Track first step creation.
- Track first included process.
- Track first run opened.
- Track first run completed.

**Acceptance criteria:**

- Events fire once per user action and do not double-fire on re-render.
- Event properties include stable identifiers where needed, but not
  user-authored checklist content.
- Offline behavior is defined: either queue events through the adapter or drop
  them intentionally with clear documentation.

### METRICS-004: Instrument growth-source attribution

**Goal:** Connect signups to launch channels and hobby wedges.

**Scope:**

- Capture landing-page source parameters such as `utm_source`, `utm_medium`,
  `utm_campaign`, and `utm_content`.
- Capture the signup answer for primary hobby if a landing page exists.
- Store attribution in a privacy-conscious way that can be joined to activation
  events.

**Acceptance criteria:**

- Signups can be grouped by channel and hobby.
- Attribution survives the handoff from landing page to app when technically
  feasible.
- Missing attribution is handled explicitly as `unknown`, not as an error.

### METRICS-005: Build the first activation dashboard

**Goal:** Make weekly product decisions from a small set of reliable metrics.

**Scope:**

- Report signups by source and hobby.
- Report signup-to-process-created conversion.
- Report process-created-to-run-opened conversion.
- Report run-opened-to-run-completed conversion.
- Report repeated-run usage.
- Report nested-include usage.

**Acceptance criteria:**

- Dashboard answers whether a launch channel produced activated users, not just
  visitors.
- Metrics can be filtered by hobby wedge.
- Definitions are documented next to the dashboard or in this doc.

### METRICS-006: Add privacy and consent notes

**Goal:** Keep tracking understandable and proportional before expanding
analytics.

**Scope:**

- Document what is tracked and what is never tracked.
- Decide whether analytics is opt-in, opt-out, or limited to operational
  product events.
- Add copy for privacy policy or account settings if needed.

**Acceptance criteria:**

- User-authored process titles, notes, step bodies, and URLs are excluded from
  analytics events by default.
- Any vendor-specific data retention or export limits are documented before
  adopting the vendor.

## Other actionable growth beads

### GROWTH-001: Create the early-access landing page

**Goal:** Collect interested users and learn which hobby wedge resonates.

**Scope:**

- Build a simple landing page with the positioning from
  [`marketing-plan.md`](./marketing-plan.md).
- Include three example workflows: photography, cycling, and 3D printing.
- Capture email, primary hobby, and the recurring checklist the visitor wants.

**Acceptance criteria:**

- The page has one primary call to action.
- Signup submissions are stored somewhere reliable.
- Source attribution can be added by `METRICS-004`.

### GROWTH-002: Write the first three template posts

**Goal:** Give communities something useful before asking them to try the app.

**Scope:**

- Camera bag checklist for weekend shoots.
- Bike tune-up checklist before a long ride.
- 3D printer maintenance checklist.

**Acceptance criteria:**

- Each post stands alone as useful content.
- Each post includes a short Reckoner mention and early-access link.
- Each post asks for additions or corrections from the community.

### GROWTH-003: Create a reusable demo asset

**Goal:** Make the product understandable in seconds.

**Scope:**

- Record or mock a short flow: create a process, include another process, run the
  checklist, complete it.
- Use one concrete example, such as "Pack camera bag" including "Camera body
  check."

**Acceptance criteria:**

- The asset can be used on the landing page and in community launch posts.
- The demo shows nesting, because that is the strongest differentiator.
- No real user data appears in the asset.

### GROWTH-004: Build a seed template library for launch

**Goal:** Give new users immediate examples that match the launch niches.

**Scope:**

- Prepare launch-ready templates for photography, cycling, and 3D printing.
- Keep templates practical and editable.
- Decide whether templates are only demo content or importable starter content.

**Acceptance criteria:**

- Each template demonstrates a real recurring workflow.
- At least one template demonstrates nested processes.
- The template copy matches the positioning in the marketing plan.

### GROWTH-005: Plan the community-posting checklist

**Goal:** Promote without spamming communities.

**Scope:**

- List target communities by hobby wedge.
- Record each community's self-promotion rules.
- Draft a useful-template-first post for each wedge.
- Track where each post was shared and what response it received.

**Acceptance criteria:**

- Every post leads with a useful workflow or question.
- Each community's rules are checked before posting.
- Responses are summarized into product or messaging learnings.

### GROWTH-006: Add an early-user interview script

**Goal:** Learn why activated users did or did not come back.

**Scope:**

- Ask which hobby they used Reckoner for.
- Ask what they created first.
- Ask whether they ran it more than once.
- Ask whether nesting made sense.
- Ask what felt confusing or missing.
- Ask whether they would be disappointed if Reckoner disappeared.

**Acceptance criteria:**

- Interview notes produce at least one concrete product, onboarding, or messaging
  action.
- Notes avoid collecting sensitive personal data.
- Findings can be grouped by hobby wedge.

### GROWTH-007: Design the template-sharing loop

**Goal:** Turn useful processes into acquisition assets.

**Scope:**

- Define what a public shared process page should show.
- Define how a visitor copies/imports a template.
- Decide how creator attribution works.
- Decide which process fields are public and which stay private.

**Acceptance criteria:**

- Shared templates can be viewed without exposing private user content.
- Importing a template is measurable by `template_imported`.
- The loop supports community posts and search-friendly pages.
