---
id: T03
parent: S02
milestone: M001
key_files:
  - apps/web/src/features/admin/pages/admin-invites.tsx
key_decisions:
  - Used ShieldCheck/ShieldOff icons consistent with existing admin-access-list.tsx pattern
  - Used Badge default variant for enabled state and outline variant for disabled state to provide clear visual distinction
  - Banner placed above AdminInvitesHeader as a simple bordered div — compact, non-intrusive diagnostic surface
duration: 
verification_result: passed
completed_at: 2026-05-28T06:39:21.992Z
blocker_discovered: false
---

# T03: Admin invites page shows a gate status banner with enabled/disabled/loading/error states using ShieldCheck/ShieldOff icons and Badge variants

**Admin invites page shows a gate status banner with enabled/disabled/loading/error states using ShieldCheck/ShieldOff icons and Badge variants**

## What Happened

Added a gate status banner to the admin invites page (`AdminInvitesPage`) that renders above the existing `AdminInvitesHeader`. The banner uses `useInvitesRequired()` — the same hook used on sign-up, sign-in, and marketing pages — and displays four states:

1. **Loading** — spinning `Loader2` icon with "Checking gate status…" in muted text.
2. **Error** — yellow `AlertTriangle` icon with "Unable to determine gate status".
3. **Enabled** (inviteRequired=true) — green `ShieldCheck` icon with a primary `Badge` reading "Enabled".
4. **Disabled** (inviteRequired=false) — muted `ShieldOff` icon with an outline `Badge` reading "Disabled".

Followed existing patterns: `ShieldCheck` and `ShieldOff` icons are already used in the admin access list, and `Badge` was already imported in this file. Added `useInvitesRequired` to the existing import from `@/features/auth/hooks/use-invites`. The banner is a compact single-line horizontal bar with border, matching the page's `space-y-6` spacing.

## Verification

Ran all three verification commands from the task plan:
1. `pnpm --filter @family-events/web check` — TypeScript compiles clean, oxlint 0 warnings/0 errors, oxfmt all files correct format.
2. `pnpm --filter @family-events/web test` — 43 test files, 419 tests passed in 6.05s.
3. `pnpm --filter @family-events/web build` — Production build succeeds (chunk size warnings only, no errors).

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `pnpm --filter @family-events/web check` | 0 | ✅ pass | 6660ms |
| 2 | `pnpm --filter @family-events/web test` | 0 | ✅ pass | 6835ms |
| 3 | `pnpm --filter @family-events/web build` | 0 | ✅ pass | 9581ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `apps/web/src/features/admin/pages/admin-invites.tsx`
