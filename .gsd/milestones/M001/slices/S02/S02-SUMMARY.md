---
id: S02
parent: M001
milestone: M001
provides:
  - Fully reactive invite gate UI across all consumer pages (sign-up, sign-in, marketing, admin-invites)
  - Admin gate status banner for operational visibility
requires:
  - slice: S01
    provides: Green CI baseline — all checks pass
affects:
  - S03
key_files:
  - apps/web/src/features/auth/pages/sign-in.tsx
  - apps/web/src/features/marketing/pages/marketing.tsx
  - apps/web/src/features/admin/pages/admin-invites.tsx
key_decisions:
  - Marketing page defaults gate-off on error (inviteRequired ?? false) for permissive UX, while auth pages default gate-on via resolveInviteRequirement() for security
  - Used HIGHLIGHTS_CLOSED/HIGHLIGHTS_OPEN arrays instead of inline ternaries for marketing page readability
  - Admin banner uses ShieldCheck/ShieldOff icons consistent with existing admin-access-list.tsx pattern
patterns_established:
  - All invite-gate consumer pages follow the same hook pattern: useInvitesRequired → destructure → compute requiresInvite → conditional render
  - Gate status diagnostic banner pattern (loading/error/enabled/disabled) reusable for future admin pages
observability_surfaces:
  - Admin invites page gate status banner shows enabled/disabled/error state as primary diagnostic surface
drill_down_paths:
  - .gsd/milestones/M001/slices/S02/tasks/T01-SUMMARY.md
  - .gsd/milestones/M001/slices/S02/tasks/T02-SUMMARY.md
  - .gsd/milestones/M001/slices/S02/tasks/T03-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-05-28T06:43:00.441Z
blocker_discovered: false
---

# S02: Reactive Invite Gate UI

**Sign-up, sign-in, marketing, and admin-invites pages all reactively render based on invites_required() RPC — gate off shows clean open-registration UI, gate on shows full invite flow**

## What Happened

Three tasks wired the invite gate RPC into every consumer page that previously had hardcoded closed-beta behavior.

**T01 — Sign-in page conditional rendering:** The sign-in page already imported `useInvitesRequired` and computed `requiresInvite`, but unconditionally rendered `<RequestInviteDialog>` and hardcoded "Use invite" link text. T01 wrapped the dialog in `{requiresInvite && ...}` and added a ternary for link text: "Use invite" when gate on, "Sign up" when gate off. Matches the existing sign-up page pattern exactly.

**T02 — Marketing page dual copy sets:** The marketing page had no gate awareness — 100% hardcoded closed-beta language. T02 added `useInvitesRequired` import, defined `HIGHLIGHTS_CLOSED` and `HIGHLIGHTS_OPEN` arrays for the three feature cards, and replaced all static copy with ternary expressions keyed on `requiresInvite`. Badge switches between "Invite-only launch" and "Open Access", hero CTA between "Use Invite"/"Get Started", bottom CTAs between invite-centric and open-registration language. Marketing defaults to gate-off on error (`inviteRequired ?? false`) — intentionally permissive to avoid blocking new user acquisition, diverging from auth pages which default gate-on for security.

**T03 — Admin invites gate status banner:** Added a diagnostic banner above the admin invites header showing loading (Loader2 spinner), error (AlertTriangle + "Unable to determine gate status"), enabled (ShieldCheck + green Badge "Enabled"), or disabled (ShieldOff + outline Badge "Disabled"). Uses the same `useInvitesRequired` hook. Icons consistent with existing admin-access-list.tsx pattern.

All three tasks completed with zero deviations from plan. The sign-up page (existing reference implementation) was not modified — it already had the correct pattern.

## Verification

All slice-level verification checks passed:

1. **TypeScript check** (`pnpm --filter @family-events/web check`): TypeScript compiles clean, oxlint 0 warnings 0 errors, oxfmt all files formatted correctly.
2. **Unit tests** (`pnpm --filter @family-events/web test`): 43 test files, 419 tests passed (15.05s). Zero failures.
3. **Production build** (`pnpm --filter @family-events/web build`): Build succeeds in 1.95s. Chunk size warnings only (pre-existing, addressed in S04).

Code inspection confirmed:
- sign-in.tsx: `RequestInviteDialog` wrapped in `{requiresInvite && ...}`, link text ternary present
- marketing.tsx: `useInvitesRequired` imported, dual highlight arrays defined, all copy conditional on `requiresInvite`
- admin-invites.tsx: `useInvitesRequired` imported, gate status banner with loading/error/enabled/disabled states

## Requirements Advanced

- R002 — All consumer pages now conditionally render invite UI based on invites_required() RPC — no hardcoded closed-beta behavior remains
- R003 — Marketing page imports useInvitesRequired and swaps between closed-beta and open-registration copy sets
- R004 — Sign-in page conditionally renders RequestInviteDialog and invite link text based on gate state
- R005 — Admin invites page displays gate status banner with enabled/disabled/loading/error states

## Requirements Validated

None.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Operational Readiness

None.

## Deviations

None.

## Known Limitations

Gate state is fetched on page load only — no real-time subscription for mid-session gate toggles. Marketing page RPC error defaults to gate-off (permissive), which could briefly show open-registration copy during backend outages even when gate is enabled.

## Follow-ups

None.

## Files Created/Modified

- `apps/web/src/features/auth/pages/sign-in.tsx` — Wrapped RequestInviteDialog in requiresInvite conditional, added ternary for link text (Sign up vs Use invite)
- `apps/web/src/features/marketing/pages/marketing.tsx` — Added useInvitesRequired hook, dual highlight arrays (HIGHLIGHTS_CLOSED/HIGHLIGHTS_OPEN), conditional copy throughout page
- `apps/web/src/features/admin/pages/admin-invites.tsx` — Added gate status banner with loading/error/enabled/disabled states using ShieldCheck/ShieldOff icons and Badge variants
