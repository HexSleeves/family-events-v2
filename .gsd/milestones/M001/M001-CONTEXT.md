# M001: Production Readiness and Open Registration

**Gathered:** 2026-05-28
**Status:** Ready for planning

## Project Description

Family Events is a consumer-facing platform for discovering local family events. The web app (React 19 + Vite 8 + Tailwind 4) is backed by Supabase (Postgres 17, edge functions, cron jobs). It has been running in closed beta behind an invite code gate. This milestone prepares the web app and Supabase backend for public launch by fixing CI issues, making the invite gate UI fully reactive, disabling the gate, and optimizing bundle sizes.

## Why This Milestone

The product is feature-complete. The invite code gate is the last barrier to open registration. CI has minor failures that must be resolved. Bundle sizes need optimization for production performance. This is the "ship it clean" milestone.

## User-Visible Outcome

### When this milestone is complete, the user can:

- Visit the marketing page and see open-registration messaging (not closed-beta language)
- Sign up with email, Apple, or Google without needing an invite code
- Sign in without seeing invite code dialogs or "Use invite" links
- (Admin) See the current gate status on the admin invites page and manage codes for future re-enablement

### Entry point / environment

- Entry point: https://family-events.up.railway.app (web) and localhost:5173 (dev)
- Environment: browser (web), local dev for verification
- Live dependencies involved: Supabase (Postgres, edge functions), Railway (hosting)

## Completion Class

- Contract complete means: CI checks pass, unit tests pass, build succeeds with no chunk warnings (except maplibre), format and lint are clean
- Integration complete means: invite gate UI responds correctly to both DB states (enabled/disabled) across all consumer-facing pages
- Operational complete means: production runbook for gate flip is documented and actionable

## Final Integrated Acceptance

To call this milestone complete, we must prove:

- `pnpm run verify:web` passes end-to-end with zero failures
- With gate disabled: sign-up, sign-in, and marketing pages show open-registration UI; OAuth buttons visible on sign-up
- With gate enabled: sign-up shows invite code field, sign-in shows request-invite dialog, marketing shows closed-beta copy
- No production build chunk exceeds 500KB except maplibre
- Admin invites page displays accurate gate status banner

## Architectural Decisions

### Disable Rather Than Remove Invite Gate

**Decision:** Set `app.settings.require_invite` to `false` via migration for local dev and document Dashboard step for production. Preserve all DB tables, triggers, RPCs, and admin UI.

**Rationale:** User wants the ability to re-enable the gate in the future. The existing architecture already supports both states — the `invites_required()` RPC and `handle_new_user` trigger both check the GUC. Removing infrastructure is irreversible and wasteful.

**Alternatives Considered:**
- Full removal of invite tables/triggers/RPCs — rejected because user wants re-enablement option
- Environment variable toggle instead of DB setting — rejected because the DB setting is already the source of truth and the trigger logic depends on it

### Make UI Reactive Via Existing RPC

**Decision:** All consumer-facing pages (sign-up, sign-in, marketing) query `invites_required()` and conditionally render invite-related UI. No new API surface needed.

**Rationale:** The RPC already exists, the sign-up page already uses it partially. Extending this pattern to sign-in and marketing is the simplest path with no new abstractions.

**Alternatives Considered:**
- Client-side feature flag via env var — rejected because the DB is already the source of truth and the trigger logic depends on it
- Build-time flag — rejected because it would require separate builds for beta/open states

### Bundle Splitting Strategy

**Decision:** Extend Vite `manualChunks` to split the `index` chunk (557KB) by extracting date-fns, radix-ui, and supabase-js into separate vendor chunks. Target: no chunk over 500KB except maplibre.

**Rationale:** maplibre is inherently large (WebGL map renderer). recharts, sentry, and motion are already isolated. The remaining index chunk contains framework deps that can be split without affecting lazy loading.

**Alternatives Considered:**
- Aggressive per-library splitting — rejected because too many small chunks increase HTTP request overhead
- Raising the chunk warning limit — rejected because it masks real performance issues

## Error Handling Strategy

- **Invite gate query failure on auth pages:** Existing `resolveInviteRequirement` defaults to `true` (gate on) when RPC fails. Safe fallback — users see invite UI rather than broken open registration. No changes needed.
- **Invite gate query failure on marketing page:** Show open-registration copy. Worst case: user sees "Sign up free" and encounters the gate check at the actual sign-up form.
- **Admin gate status query failure:** Show "Unable to determine gate status" banner rather than guessing.
- **No new error surfaces:** This milestone is a simplification, not an addition.

## Risks and Unknowns

- Exact composition of index/client chunks is approximate — actual split points need build instrumentation during S04
- There may be additional hardcoded "beta" or "invite" references not yet found — S02 should do a thorough sweep

## Existing Codebase / Prior Art

- `supabase/migrations/20260601000000_schema_baseline.sql` — `handle_new_user()`, `enforce_invited_oauth_signup()`, `invites_required()` functions
- `apps/web/src/features/auth/hooks/use-invites.ts` — `useInvitesRequired()` hook, already used by sign-up page
- `apps/web/src/features/auth/lib/auth-closed-beta.ts` — invite gate helper functions
- `apps/web/src/features/auth/pages/sign-up.tsx` — partially reactive (conditionally shows invite field and OAuth)
- `apps/web/src/features/auth/pages/sign-in.tsx` — NOT reactive (always shows RequestInviteDialog and "Use invite" link)
- `apps/web/src/features/marketing/pages/marketing.tsx` — entirely hardcoded closed-beta copy
- `apps/web/src/features/admin/pages/admin-invites.tsx` — admin invite management, no gate status display
- `apps/web/vite.config.ts` — existing manualChunks for maplibre, recharts, sentry, motion
- `supabase/tests/invite_gate_oauth_signup.sql` — existing SQL test covering both gate states

## Relevant Requirements

- R001–R009: CI, invite gate UI, migration, documentation
- R010–R012: Bundle optimization and final verification
- R013–R015: Out-of-scope constraints (mobile, DB removal, marketing redesign)

## Scope

### In Scope

- Fix 3 format violations and 1 Deno test naming issue
- Remove stale .orig files
- Make sign-in page invite UI conditional on gate state
- Make marketing page copy conditional on gate state
- Add gate status banner to admin invites page
- Write migration to disable gate for local dev
- Document production gate flip runbook
- Optimize bundle splitting to get index chunk under 500KB
- Run verify:web end-to-end as final gate

### Out of Scope / Non-Goals

- iOS or Android changes
- Removing invite DB tables, triggers, or RPCs
- Marketing page redesign beyond copy swap
- New features or capabilities
- Supabase edge function changes (beyond test naming fix)

## Technical Constraints

- Supabase Cloud blocks `ALTER DATABASE SET app.settings.*` — production gate flip must use Dashboard
- Existing `_test.ts` vs `.test.ts` convention split for Deno vs Vitest tests must be maintained
- oxlint + oxfmt are the only permitted linter/formatter (no ESLint/Prettier)
- maplibre chunk will remain over 500KB — it's a WebGL renderer and cannot be meaningfully split

## Integration Points

- Supabase `invites_required()` RPC — queried by web frontend to determine gate state
- Supabase `app.settings.require_invite` GUC — source of truth for gate state
- Railway deployment — web app deployed here, build must succeed
- Supabase Dashboard — production gate flip requires manual setting change

## Testing Requirements

- Unit tests: all 419 existing tests pass, auth-closed-beta tests updated if interface changes
- Workspace guards: all 52 guards pass
- E2e: existing Playwright smoke tests pass (admin invites walkthrough may need adjustment for gate banner)
- SQL tests: invite_gate_oauth_signup.sql continues to pass
- Bundle budget: web-bundle-budget guard passes

## Acceptance Criteria

- S01: `web:check`, `web:test`, `packages:check`, `packages:test`, `workspace:test` all exit 0
- S02: Browser verification of both gate states across sign-up, sign-in, marketing, admin invites
- S03: Local dev starts with gate disabled; runbook document exists in supabase/docs/
- S04: `web:build` produces no chunk over 500KB except maplibre; `verify:web` exits 0

## Open Questions

- None — all scope and architecture decisions confirmed during discussion.
