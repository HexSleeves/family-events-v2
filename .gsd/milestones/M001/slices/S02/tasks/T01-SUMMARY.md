---
id: T01
parent: S02
milestone: M001
key_files:
  - apps/web/src/features/auth/pages/sign-in.tsx
key_decisions:
  - Matched sign-up page pattern for conditional RequestInviteDialog rendering
duration: 
verification_result: passed
completed_at: 2026-05-28T06:37:40.297Z
blocker_discovered: false
---

# T01: Sign-in page conditionally renders RequestInviteDialog and link text based on invite gate state

**Sign-in page conditionally renders RequestInviteDialog and link text based on invite gate state**

## What Happened

The sign-in page already imported `useInvitesRequired` and computed `requiresInvite`, but unconditionally rendered `<RequestInviteDialog>` and hardcoded "Use invite" link text. Two surgical changes were made:

1. Wrapped the `<RequestInviteDialog>` render block in `{requiresInvite && ...}` — matching the sign-up page pattern where the dialog only appears when the invite gate is active.
2. Changed the bottom link text from hardcoded `"Use invite"` to `{requiresInvite ? "Use invite" : "Sign up"}` so when the gate is off, users see a clean "Sign up" call-to-action instead of confusing invite language.

Both changes are minimal and consistent with the reference implementation in sign-up.tsx.

## Verification

pnpm --filter @family-events/web check — TypeScript compiles clean, oxlint 0 warnings 0 errors, oxfmt all files formatted correctly. pnpm --filter @family-events/web test — 43 test files, 419 tests passed in 3.18s.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `pnpm --filter @family-events/web check` | 0 | ✅ pass | 5647ms |
| 2 | `pnpm --filter @family-events/web test` | 0 | ✅ pass | 3798ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `apps/web/src/features/auth/pages/sign-in.tsx`
