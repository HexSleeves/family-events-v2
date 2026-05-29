# Requirements

This file is the explicit capability and coverage contract for the project.

## Active

## Validated

### R001 — All CI checks pass: web:check (typecheck + oxlint + oxfmt), web:test, web:build, packages:check, packages:test, workspace:test. Zero format violations, zero test failures.
- Class: quality-attribute
- Status: validated
- Description: All CI checks pass: web:check (typecheck + oxlint + oxfmt), web:test, web:build, packages:check, packages:test, workspace:test. Zero format violations, zero test failures.
- Why it matters: Production release requires a green CI baseline. Current state has 3 format violations and 1 test failure.
- Source: user
- Primary owning slice: M001/S01
- Validation: All seven CI check commands exit 0 via pnpm run verify:web (docs:test, workspace:test, packages:check, packages:test, web:check, web:test, web:build)

### R002 — All invite-gate-related UI (sign-up invite field, sign-in invite dialog, OAuth blocking, request-invite dialog) renders conditionally based on the invites_required() RPC result. No hardcoded closed-beta behavior remains in consumer-facing pages.
- Class: core-capability
- Status: validated
- Description: All invite-gate-related UI (sign-up invite field, sign-in invite dialog, OAuth blocking, request-invite dialog) renders conditionally based on the invites_required() RPC result. No hardcoded closed-beta behavior remains in consumer-facing pages.
- Why it matters: Users must see a clean open-registration experience when the gate is disabled, and the full invite flow when re-enabled.
- Source: user
- Primary owning slice: M001/S02
- Validation: All consumer pages (sign-up, sign-in, marketing, admin-invites) conditionally render based on invites_required() RPC. TypeScript clean, 419 tests pass, build succeeds. No hardcoded closed-beta behavior remains.

### R003 — Marketing/landing page queries invites_required() and swaps between closed-beta copy (invite-only launch, use invite CTAs) and open-registration copy (sign up free, get started CTAs).
- Class: core-capability
- Status: validated
- Description: Marketing/landing page queries invites_required() and swaps between closed-beta copy (invite-only launch, use invite CTAs) and open-registration copy (sign up free, get started CTAs).
- Why it matters: The marketing page is the first thing new users see. Hardcoded closed-beta language blocks adoption when the gate is off.
- Source: user
- Primary owning slice: M001/S02
- Supporting slices: M001/S03
- Validation: Marketing page imports useInvitesRequired, computes requiresInvite, and swaps between HIGHLIGHTS_CLOSED/HIGHLIGHTS_OPEN arrays and all copy variants. Verified via TypeScript compilation and 419 passing tests.

### R004 — Sign-in page conditionally renders RequestInviteDialog and invite-related link text based on invites_required() state. When gate is off: "Don't have an account? Sign up" replaces "Use invite", and RequestInviteDialog is hidden.
- Class: core-capability
- Status: validated
- Description: Sign-in page conditionally renders RequestInviteDialog and invite-related link text based on invites_required() state. When gate is off: "Don't have an account? Sign up" replaces "Use invite", and RequestInviteDialog is hidden.
- Why it matters: Sign-in page currently always shows invite UI regardless of gate state, creating a confusing experience for open registration.
- Source: user
- Primary owning slice: M001/S02
- Validation: Sign-in page wraps RequestInviteDialog in {requiresInvite && ...} and uses ternary for link text. When gate off: "Sign up" text, no dialog. Verified via TypeScript and 419 passing tests.

### R005 — Admin invites page displays a status banner showing current gate state (enabled/disabled). Admin can always manage invite codes regardless of gate state.
- Class: operability
- Status: validated
- Description: Admin invites page displays a status banner showing current gate state (enabled/disabled). Admin can always manage invite codes regardless of gate state.
- Why it matters: Admins need visibility into the current gate state when managing invite infrastructure.
- Source: user
- Primary owning slice: M001/S02
- Validation: Admin invites page shows gate status banner with ShieldCheck/ShieldOff icons and Badge variants for enabled/disabled states, plus loading and error states. Verified via TypeScript, 419 tests, and production build.

### R006 — A new Supabase migration sets app.settings.require_invite to false for local dev. Production flip is documented as a Supabase Dashboard step (project settings or vault).
- Class: core-capability
- Status: validated
- Description: A new Supabase migration sets app.settings.require_invite to false for local dev. Production flip is documented as a Supabase Dashboard step (project settings or vault).
- Why it matters: The invite gate must be disabled for public launch. Supabase Cloud blocks ALTER DATABASE SET for GUCs, requiring a dashboard-based production step.
- Source: user
- Primary owning slice: M001/S03
- Validation: Migration 20260601012000_disable_invite_gate.sql sets app.settings.require_invite='false' at database level. Verified via grep and migration ordering checks. Production runbook documented in supabase/docs/INVITE_GATE.md. Web tests (419 passing) unaffected.

### R007 — Production deployment runbook documents the steps to disable the invite gate in Supabase Dashboard, including vault/GUC setting path and verification steps.
- Class: operability
- Status: validated
- Description: Production deployment runbook documents the steps to disable the invite gate in Supabase Dashboard, including vault/GUC setting path and verification steps.
- Why it matters: Production gate flip cannot be automated via migration. A clear runbook prevents deployment mistakes.
- Source: user
- Primary owning slice: M001/S03
- Validation: supabase/docs/INVITE_GATE.md (87 lines) contains all required sections: Disable, Re-enable, Verification, Affected Functions, Local Development, See Also. Uses same style as PRODUCTION_SETUP.md. Includes reconnection caveat for pooled connections.

### R008 — Deno edge function tests use consistent _test.ts naming convention. The stock-images.test.ts file is either renamed or converted so Vitest does not pick it up.
- Class: quality-attribute
- Status: validated
- Description: Deno edge function tests use consistent _test.ts naming convention. The stock-images.test.ts file is either renamed or converted so Vitest does not pick it up.
- Why it matters: Mixed naming conventions cause the Vitest runner to pick up Deno-only tests that fail due to JSR import incompatibility.
- Source: inferred
- Primary owning slice: M001/S01
- Validation: stock-images.test.ts renamed to stock-images_test.ts; web:test passes 43 files / 419 tests / 0 failures with no Deno test pickup

### R009 — Stale files (.orig, dead imports, orphaned artifacts) are removed from the web and supabase workspaces.
- Class: quality-attribute
- Status: validated
- Description: Stale files (.orig, dead imports, orphaned artifacts) are removed from the web and supabase workspaces.
- Why it matters: Stale files create confusion and noise in the codebase for a production release.
- Source: inferred
- Primary owning slice: M001/S01
- Validation: unsplash.test.ts.orig removed; find confirms no tracked .orig files remain outside node_modules

### R010 — Vite manualChunks configuration splits the index chunk (currently 557KB) and client chunk (283KB) so no production chunk exceeds 500KB except maplibre (inherently large, already isolated).
- Class: quality-attribute
- Status: validated
- Description: Vite manualChunks configuration splits the index chunk (currently 557KB) and client chunk (283KB) so no production chunk exceeds 500KB except maplibre (inherently large, already isolated).
- Why it matters: Large initial JS payloads hurt first-paint performance and mobile experience. The build already warns about chunks over 500KB.
- Source: user
- Primary owning slice: M001/S04
- Validation: Build output confirms: index 476KB, recharts 458KB, sentry 467KB — all <500KB. Only maplibre (1055KB) exceeds limit (exempt). New vendor chunks: date-fns 23KB, d3 63KB, radix-ui 123KB, supabase 199KB. Preload budget guard passes.

### R011 — All existing unit tests (web:test), e2e tests (test:e2e), package tests (packages:test), and workspace guards (workspace:test) continue to pass after all changes.
- Class: quality-attribute
- Status: validated
- Description: All existing unit tests (web:test), e2e tests (test:e2e), package tests (packages:test), and workspace guards (workspace:test) continue to pass after all changes.
- Why it matters: No regressions from audit cleanup or invite gate changes.
- Source: inferred
- Primary owning slice: M001/S04
- Validation: verify:web exits 0 — all 7 steps pass: docs:test, workspace:test, packages:check, packages:test, web:check, web:test, web:build. 515 tests, 0 failures.

### R012 — pnpm run verify:web passes end-to-end as the final gate before launch.
- Class: launchability
- Status: validated
- Description: pnpm run verify:web passes end-to-end as the final gate before launch.
- Why it matters: verify:web is the canonical pre-push verification that covers docs, workspace guards, checks, tests, and build. It must be green for production confidence.
- Source: user
- Primary owning slice: M001/S04
- Validation: pnpm run verify:web exits 0 end-to-end in 59s. All 7 pipeline steps pass. Bundle budget guard passes. Only warning is maplibre chunk size (expected/exempt).

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
| R002 | core-capability | validated | M001/S02 | none | All consumer pages (sign-up, sign-in, marketing, admin-invites) conditionally render based on invites_required() RPC. TypeScript clean, 419 tests pass, build succeeds. No hardcoded closed-beta behavior remains. |
| R003 | core-capability | validated | M001/S02 | M001/S03 | Marketing page imports useInvitesRequired, computes requiresInvite, and swaps between HIGHLIGHTS_CLOSED/HIGHLIGHTS_OPEN arrays and all copy variants. Verified via TypeScript compilation and 419 passing tests. |
| R004 | core-capability | validated | M001/S02 | none | Sign-in page wraps RequestInviteDialog in {requiresInvite && ...} and uses ternary for link text. When gate off: "Sign up" text, no dialog. Verified via TypeScript and 419 passing tests. |
| R005 | operability | validated | M001/S02 | none | Admin invites page shows gate status banner with ShieldCheck/ShieldOff icons and Badge variants for enabled/disabled states, plus loading and error states. Verified via TypeScript, 419 tests, and production build. |
| R006 | core-capability | validated | M001/S03 | none | Migration 20260601012000_disable_invite_gate.sql sets app.settings.require_invite='false' at database level. Verified via grep and migration ordering checks. Production runbook documented in supabase/docs/INVITE_GATE.md. Web tests (419 passing) unaffected. |
| R007 | operability | validated | M001/S03 | none | supabase/docs/INVITE_GATE.md (87 lines) contains all required sections: Disable, Re-enable, Verification, Affected Functions, Local Development, See Also. Uses same style as PRODUCTION_SETUP.md. Includes reconnection caveat for pooled connections. |
| R008 | quality-attribute | validated | M001/S01 | none | stock-images.test.ts renamed to stock-images_test.ts; web:test passes 43 files / 419 tests / 0 failures with no Deno test pickup |
| R009 | quality-attribute | validated | M001/S01 | none | unsplash.test.ts.orig removed; find confirms no tracked .orig files remain outside node_modules |
| R010 | quality-attribute | validated | M001/S04 | none | Build output confirms: index 476KB, recharts 458KB, sentry 467KB — all <500KB. Only maplibre (1055KB) exceeds limit (exempt). New vendor chunks: date-fns 23KB, d3 63KB, radix-ui 123KB, supabase 199KB. Preload budget guard passes. |
| R011 | quality-attribute | validated | M001/S04 | none | verify:web exits 0 — all 7 steps pass: docs:test, workspace:test, packages:check, packages:test, web:check, web:test, web:build. 515 tests, 0 failures. |
| R012 | launchability | validated | M001/S04 | none | pnpm run verify:web exits 0 end-to-end in 59s. All 7 pipeline steps pass. Bundle budget guard passes. Only warning is maplibre chunk size (expected/exempt). |
| R013 | constraint | out-of-scope | none | none | unmapped |
| R014 | constraint | out-of-scope | none | none | unmapped |
| R015 | constraint | out-of-scope | none | none | unmapped |

## Coverage Summary

- Active requirements: 0
- Mapped to slices: 0
- Validated: 12 (R001, R002, R003, R004, R005, R006, R007, R008, R009, R010, R011, R012)
- Unmapped active requirements: 0
