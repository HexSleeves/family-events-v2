---
estimated_steps: 18
estimated_files: 1
skills_used: []
---

# T02: Make marketing page reactive to invite gate state with dual copy sets

**Why:** The marketing page (marketing.tsx, 100 lines) is entirely hardcoded with closed-beta language: "Invite-only launch" badge, "closed rollout" paragraph, "Sign up with invite" CTA, "Already invited?" button, and three highlight cards with invite-centric descriptions. It does not import `useInvitesRequired` at all. New users see invite-only messaging even when registration is open. This is the highest-impact change in S02. Satisfies R003.

**Do:**
1. Read `apps/web/src/features/marketing/pages/marketing.tsx` fully.
2. Read `apps/web/src/features/auth/hooks/use-invites.ts` for the hook interface.
3. Import `useInvitesRequired` and `resolveInviteRequirement` from `@/features/auth/hooks/use-invites`.
4. At the top of `MarketingPage`, call `useInvitesRequired()` and derive `requiresInvite` via `resolveInviteRequirement(data, isError)`. For marketing, consider defaulting to gate-off on error (unlike auth pages which default gate-on) to avoid blocking new user acquisition — use `resolveInviteRequirement(inviteRequired, false)` or inline: `const requiresInvite = inviteRequired ?? false` when RPC errors. Document this difference with a comment.
5. Create two copy sets (can be inline ternaries or const objects):
   - **Gate ON (closed beta):** Current copy unchanged — "Invite-only launch" badge, "closed rollout" paragraph, "Sign up with invite" CTA, "Already invited?" secondary CTA, invite-centric highlight descriptions.
   - **Gate OFF (open registration):** Badge hidden or shows "Now Open", hero copy swaps to open-registration language (e.g. "Browse curated events, save favorites, and plan the week in one place."), primary CTA becomes "Get started free" linking to /sign-up, secondary CTA becomes "Sign in" linking to /sign-in, header CTA becomes "Get Started" linking to /sign-up, highlight card descriptions swap to open-access language.
6. Create a second HIGHLIGHTS array or use inline ternaries for the three card descriptions:
   - "Curated events" → keep title, swap description to open-access version
   - "City-aware discovery" → keep title, swap description to remove "once invited"
   - "Closed release" → swap title to "Open access" or similar, swap description
7. Conditionally render the Badge (hide when gate off, or swap to "Now Open").
8. Handle loading state: `useInvitesRequired` starts with undefined data. For marketing, show open-registration copy as default to avoid closed-beta flash (since target state per D001 is gate-off).
9. Run `pnpm --filter @family-events/web check` and `pnpm --filter @family-events/web test`.
10. Ensure oxlint/oxfmt formatting passes.

**Done when:** marketing.tsx imports `useInvitesRequired`, conditionally renders all copy/CTAs/badge/highlights based on gate state. Gate-off shows clean open-registration experience. Gate-on preserves current closed-beta copy. TypeScript compiles clean. All tests pass.

## Inputs

- `apps/web/src/features/marketing/pages/marketing.tsx`
- `apps/web/src/features/auth/hooks/use-invites.ts`
- `apps/web/src/features/auth/pages/sign-up.tsx`

## Expected Output

- `apps/web/src/features/marketing/pages/marketing.tsx`

## Verification

pnpm --filter @family-events/web check && pnpm --filter @family-events/web test

## Observability Impact

None — client-side UI rendering only.
