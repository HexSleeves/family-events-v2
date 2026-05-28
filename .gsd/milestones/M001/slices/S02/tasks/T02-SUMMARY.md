---
id: T02
parent: S02
milestone: M001
key_files:
  - apps/web/src/features/marketing/pages/marketing.tsx
key_decisions:
  - Marketing page defaults to gate-off on error (inviteRequired ?? false) to avoid blocking new user acquisition — intentional divergence from auth pages which default gate-on for security
  - Used separate HIGHLIGHTS_CLOSED/HIGHLIGHTS_OPEN arrays instead of inline ternaries for readability
  - Added Sparkles icon for open-access badge and highlight card
duration: 
verification_result: passed
completed_at: 2026-05-28T06:37:40.299Z
blocker_discovered: false
---

# T02: Marketing page reactively renders dual copy sets (open vs closed beta) based on invite gate state

**Marketing page reactively renders dual copy sets (open vs closed beta) based on invite gate state**

## What Happened

The marketing page was entirely hardcoded with closed-beta language. Implemented full gate-reactive UI:

1. Imported `useInvitesRequired` from the auth hooks module.
2. Added `requiresInvite` derivation with marketing-specific defaulting: `inviteRequired ?? false` — intentionally defaults to gate-off on error to avoid blocking new user acquisition (unlike auth pages which default gate-on for security). Documented this divergence with a comment.
3. Created two highlight arrays (`HIGHLIGHTS_CLOSED` and `HIGHLIGHTS_OPEN`) with gate-specific copy:
   - "Closed release" card becomes "Open access" with Sparkles icon when gate is off
   - "once invited" language removed from city-aware discovery in open mode
   - "private launch catalog" becomes "Browse a curated catalog" in open mode
4. Conditionally rendered: Badge (Invite-only vs Now Open), hero paragraph, CTAs ("Sign up with invite"/"Already invited?" vs "Get started free"/"Sign in"), and header CTA ("Use Invite" vs "Get Started").
5. Added Sparkles icon import from lucide-react for the open-access badge and highlight card.
6. Loading state handled implicitly: `inviteRequired ?? false` means while data is undefined (loading), open-registration copy displays — avoiding closed-beta flash since the target state per D001 is gate-off.

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

- `apps/web/src/features/marketing/pages/marketing.tsx`
