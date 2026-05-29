# M001: Production Readiness and Open Registration

**Vision:** Prepare the web app and Supabase backend for public launch: fix CI issues, make the invite gate UI fully reactive to DB state, disable the gate for open registration, and optimize bundle sizes.

## Success Criteria

- pnpm run verify:web passes end-to-end with zero failures
- With gate disabled: sign-up, sign-in, and marketing pages show open-registration UI; OAuth buttons visible on sign-up
- With gate enabled: sign-up shows invite code field, sign-in shows request-invite dialog, marketing shows closed-beta copy
- No production build chunk exceeds 500KB except maplibre
- Admin invites page displays accurate gate status banner

## Slices

- [x] **S01: CI Green Baseline and Audit Cleanup** `risk:low` `depends:[]`
  > After this: After this: all six CI check commands (web:check, web:test, web:build, packages:check, packages:test, workspace:test) pass with zero failures. Stale files removed, Deno test naming fixed.

- [x] **S02: Reactive Invite Gate UI** `risk:medium` `depends:[S01]`
  > After this: After this: sign-up, sign-in, marketing page, and admin invites all respond to invites_required() RPC. Gate disabled shows open-registration UI everywhere; gate enabled shows full invite UI.

- [x] **S03: Disable Invite Gate and Production Runbook** `risk:low` `depends:[S02]`
  > After this: After this: local dev starts with the invite gate disabled (open registration). A production runbook in supabase/docs/ documents the Dashboard steps to flip the gate in production.

- [x] **S04: Bundle Optimization and Final Verification** `risk:medium` `depends:[S01]`
  > After this: After this: web:build produces no chunk over 500KB except maplibre. pnpm run verify:web passes end-to-end.

## Boundary Map

### S01 → S02

Produces:
- Green CI baseline — all checks pass, format violations fixed, Deno test naming resolved
- Clean codebase — stale files removed

Consumes:
- nothing (first slice)

### S01 → S04

Produces:
- Green test/check baseline that S04 final verification depends on

Consumes:
- nothing (first slice)

### S02 → S03

Produces:
- Fully reactive invite gate UI that responds to invites_required() RPC across all consumer pages
- Admin invites page with gate status banner

Consumes:
- Green CI baseline from S01

### S03 → S04

Produces:
- Migration disabling invite gate for local dev
- Production runbook document

Consumes:
- Reactive UI from S02 (so the disabled gate produces correct open-registration UI)

### S04 (final)

Produces:
- Optimized bundle splitting
- Full verification pass

Consumes:
- All prior slices: green baseline (S01), reactive UI (S02), disabled gate (S03)
