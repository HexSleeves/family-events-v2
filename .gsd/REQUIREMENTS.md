# Requirements

This file is the explicit capability and coverage contract for the project.

## Active

### R002 — All invite-gate-related UI (sign-up invite field, sign-in invite dialog, OAuth blocking, request-invite dialog) renders conditionally based on the invites_required() RPC result. No hardcoded closed-beta behavior remains in consumer-facing pages.
- Class: core-capability
- Status: active
- Description: All invite-gate-related UI (sign-up invite field, sign-in invite dialog, OAuth blocking, request-invite dialog) renders conditionally based on the invites_required() RPC result. No hardcoded closed-beta behavior remains in consumer-facing pages.
- Why it matters: Users must see a clean open-registration experience when the gate is disabled, and the full invite flow when re-enabled.
- Source: user
- Primary owning slice: M001/S02
- Validation: Browser verification: gate disabled shows no invite UI; gate enabled shows full invite UI on sign-up, sign-in, and marketing pages

### R003 — Marketing/landing page queries invites_required() and swaps between closed-beta copy (invite-only launch, use invite CTAs) and open-registration copy (sign up free, get started CTAs).
- Class: core-capability
- Status: active
- Description: Marketing/landing page queries invites_required() and swaps between closed-beta copy (invite-only launch, use invite CTAs) and open-registration copy (sign up free, get started CTAs).
- Why it matters: The marketing page is the first thing new users see. Hardcoded closed-beta language blocks adoption when the gate is off.
- Source: user
- Primary owning slice: M001/S02
- Supporting slices: M001/S03
- Validation: Marketing page renders open-registration copy when gate is disabled

### R004 — Sign-in page conditionally renders RequestInviteDialog and invite-related link text based on invites_required() state. When gate is off: "Don't have an account? Sign up" replaces "Use invite", and RequestInviteDialog is hidden.
- Class: core-capability
- Status: active
- Description: Sign-in page conditionally renders RequestInviteDialog and invite-related link text based on invites_required() state. When gate is off: "Don't have an account? Sign up" replaces "Use invite", and RequestInviteDialog is hidden.
- Why it matters: Sign-in page currently always shows invite UI regardless of gate state, creating a confusing experience for open registration.
- Source: user
- Primary owning slice: M001/S02
- Validation: Sign-in page shows no invite references when gate is disabled

### R005 — Admin invites page displays a status banner showing current gate state (enabled/disabled). Admin can always manage invite codes regardless of gate state.
- Class: operability
- Status: active
- Description: Admin invites page displays a status banner showing current gate state (enabled/disabled). Admin can always manage invite codes regardless of gate state.
- Why it matters: Admins need visibility into the current gate state when managing invite infrastructure.
- Source: user
- Primary owning slice: M001/S02
- Validation: Admin invites page shows accurate gate status banner

### R006 — A new Supabase migration sets app.settings.require_invite to false for local dev. Production flip is documented as a Supabase Dashboard step (project settings or vault).
- Class: core-capability
- Status: active
- Description: A new Supabase migration sets app.settings.require_invite to false for local dev. Production flip is documented as a Supabase Dashboard step (project settings or vault).
- Why it matters: The invite gate must be disabled for public launch. Supabase Cloud blocks ALTER DATABASE SET for GUCs, requiring a dashboard-based production step.
- Source: user
- Primary owning slice: M001/S03
- Validation: Local dev starts with gate disabled; production runbook documented

### R007 — Production deployment runbook documents the steps to disable the invite gate in Supabase Dashboard, including vault/GUC setting path and verification steps.
- Class: operability
- Status: active
- Description: Production deployment runbook documents the steps to disable the invite gate in Supabase Dashboard, including vault/GUC setting path and verification steps.
- Why it matters: Production gate flip cannot be automated via migration. A clear runbook prevents deployment mistakes.
- Source: user
- Primary owning slice: M001/S03
- Validation: Runbook document exists with step-by-step instructions

### R009 — Stale files (.orig, dead imports, orphaned artifacts) are removed from the web and supabase workspaces.
- Class: quality-attribute
- Status: active
- Description: Stale files (.orig, dead imports, orphaned artifacts) are removed from the web and supabase workspaces.
- Why it matters: Stale files create confusion and noise in the codebase for a production release.
- Source: inferred
- Primary owning slice: M001/S01
- Validation: No .orig files in tracked directories; knip reports clean

### R010 — Vite manualChunks configuration splits the index chunk (currently 557KB) and client chunk (283KB) so no production chunk exceeds 500KB except maplibre (inherently large, already isolated).
- Class: quality-attribute
- Status: active
- Description: Vite manualChunks configuration splits the index chunk (currently 557KB) and client chunk (283KB) so no production chunk exceeds 500KB except maplibre (inherently large, already isolated).
- Why it matters: Large initial JS payloads hurt first-paint performance and mobile experience. The build already warns about chunks over 500KB.
- Source: user
- Primary owning slice: M001/S04
- Validation: pnpm run web:build produces no chunk warnings except maplibre; preload budget guard passes

### R011 — All existing unit tests (web:test), e2e tests (test:e2e), package tests (packages:test), and workspace guards (workspace:test) continue to pass after all changes.
- Class: quality-attribute
- Status: active
- Description: All existing unit tests (web:test), e2e tests (test:e2e), package tests (packages:test), and workspace guards (workspace:test) continue to pass after all changes.
- Why it matters: No regressions from audit cleanup or invite gate changes.
- Source: inferred
- Primary owning slice: M001/S04
- Validation: All test suites exit 0

### R012 — pnpm run verify:web passes end-to-end as the final gate before launch.
- Class: launchability
- Status: active
- Description: pnpm run verify:web passes end-to-end as the final gate before launch.
- Why it matters: verify:web is the canonical pre-push verification that covers docs, workspace guards, checks, tests, and build. It must be green for production confidence.
- Source: user
- Primary owning slice: M001/S04
- Validation: verify:web exits 0

## Validated

### R001 — All CI checks pass: web:check (typecheck + oxlint + oxfmt), web:test, web:build, packages:check, packages:test, workspace:test. Zero format violations, zero test failures.
- Class: quality-attribute
- Status: validated
- Description: All CI checks pass: web:check (typecheck + oxlint + oxfmt), web:test, web:build, packages:check, packages:test, workspace:test. Zero format violations, zero test failures.
- Why it matters: Production release requires a green CI baseline. Current state has 3 format violations and 1 test failure.
- Source: user
- Primary owning slice: M001/S01
- Validation: All seven CI check commands exit 0 via pnpm run verify:web (docs:test, workspace:test, packages:check, packages:test, web:check, web:test, web:build)

### R008 — Deno edge function tests use consistent _test.ts naming convention. The stock-images.test.ts file is either renamed or converted so Vitest does not pick it up.
- Class: quality-attribute
- Status: validated
- Description: Deno edge function tests use consistent _test.ts naming convention. The stock-images.test.ts file is either renamed or converted so Vitest does not pick it up.
- Why it matters: Mixed naming conventions cause the Vitest runner to pick up Deno-only tests that fail due to JSR import incompatibility.
- Source: inferred
- Primary owning slice: M001/S01
- Validation: stock-images.test.ts renamed to stock-images_test.ts; web:test passes 43 files / 419 tests / 0 failures with no Deno test pickup

## Deferred

## Out of Scope

### R013 — iOS and Android apps are not modified in this milestone.
- Class: constraint
- Status: out-of-scope
- Description: iOS and Android apps are not modified in this milestone.
- Why it matters: Mobile clients are already production-ready from the user's perspective. Scope is web + Supabase only.
- Source: user

### R014 — Invite DB tables (invite_codes, pending_invite_claims, invite_requests), triggers, and RPCs are preserved. The gate is disabled, not removed.
- Class: constraint
- Status: out-of-scope
- Description: Invite DB tables (invite_codes, pending_invite_claims, invite_requests), triggers, and RPCs are preserved. The gate is disabled, not removed.
- Why it matters: User wants the ability to re-enable the invite gate in the future.
- Source: user

### R015 — Marketing page gets conditional copy swap, not a full redesign.
- Class: constraint
- Status: out-of-scope
- Description: Marketing page gets conditional copy swap, not a full redesign.
- Why it matters: Scope is limited to making existing copy responsive to gate state, not creating new marketing content.
- Source: user

## Traceability

| ID | Class | Status | Primary owner | Supporting | Proof |
|---|---|---|---|---|---|
| R001 | quality-attribute | validated | M001/S01 | none | All seven CI check commands exit 0 via pnpm run verify:web (docs:test, workspace:test, packages:check, packages:test, web:check, web:test, web:build) |
| R002 | core-capability | active | M001/S02 | none | Browser verification: gate disabled shows no invite UI; gate enabled shows full invite UI on sign-up, sign-in, and marketing pages |
| R003 | core-capability | active | M001/S02 | M001/S03 | Marketing page renders open-registration copy when gate is disabled |
| R004 | core-capability | active | M001/S02 | none | Sign-in page shows no invite references when gate is disabled |
| R005 | operability | active | M001/S02 | none | Admin invites page shows accurate gate status banner |
| R006 | core-capability | active | M001/S03 | none | Local dev starts with gate disabled; production runbook documented |
| R007 | operability | active | M001/S03 | none | Runbook document exists with step-by-step instructions |
| R008 | quality-attribute | validated | M001/S01 | none | stock-images.test.ts renamed to stock-images_test.ts; web:test passes 43 files / 419 tests / 0 failures with no Deno test pickup |
| R009 | quality-attribute | active | M001/S01 | none | No .orig files in tracked directories; knip reports clean |
| R010 | quality-attribute | active | M001/S04 | none | pnpm run web:build produces no chunk warnings except maplibre; preload budget guard passes |
| R011 | quality-attribute | active | M001/S04 | none | All test suites exit 0 |
| R012 | launchability | active | M001/S04 | none | verify:web exits 0 |
| R013 | constraint | out-of-scope | none | none | unmapped |
| R014 | constraint | out-of-scope | none | none | unmapped |
| R015 | constraint | out-of-scope | none | none | unmapped |

## Coverage Summary

- Active requirements: 10
- Mapped to slices: 10
- Validated: 2 (R001, R008)
- Unmapped active requirements: 0
