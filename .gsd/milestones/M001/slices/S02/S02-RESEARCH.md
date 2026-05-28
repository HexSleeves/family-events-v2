# S02: Reactive Invite Gate UI — Research

**Date:** 2026-05-28
**Depth:** Targeted research

## Summary

S02 makes all consumer-facing pages react to the `invites_required()` RPC instead of showing hardcoded closed-beta UI. The sign-up page already does this correctly — it uses `useInvitesRequired()` + `resolveInviteRequirement()` and conditionally renders the invite code field, OAuth buttons, and `RequestInviteDialog`. The remaining work is extending this proven pattern to three more pages: sign-in, marketing, and admin invites.

The sign-in page (`sign-in.tsx`) already imports `useInvitesRequired` and uses `requiresInvite` for OAuth blocking and magic-link invite redemption — but it unconditionally renders `RequestInviteDialog` and hardcodes `"Use invite"` link text at the bottom. These two elements need to be wrapped in `{requiresInvite && ...}` guards, and the link text needs a conditional swap.

The marketing page (`marketing.tsx`) is entirely hardcoded with closed-beta language: "Invite-only launch" badge, "closed rollout" paragraph, "Sign up with invite" CTA, "Already invited?" button, and three highlight cards with invite-related descriptions. This page doesn't import `useInvitesRequired` at all — the hook needs to be added and all copy/CTAs made conditional.

The admin invites page (`admin-invites.tsx`) manages invite codes but has no gate status banner. A simple `useInvitesRequired()` call at the top with a Banner/Alert component showing "Invite gate: enabled/disabled" satisfies R005.

## Recommendation

Follow the sign-up page pattern exactly: import `useInvitesRequired` + `resolveInviteRequirement`, derive `requiresInvite`, wrap invite-specific UI in conditionals. No new hooks, no new API surface, no new abstractions. The four pages are independent — they can be modified in parallel.

Start with the sign-in page as the first proof — it's the smallest change (2 conditional wraps + 1 text swap) and validates the pattern extension. Then marketing (biggest change — full copy swap), then admin banner (new UI element).

## Implementation Landscape

### Key Files

- `apps/web/src/features/auth/hooks/use-invites.ts` — `useInvitesRequired()` hook and `resolveInviteRequirement()` helper. **No changes needed** — the interface is stable and already exported.
- `apps/web/src/features/auth/lib/auth-closed-beta.ts` — `getProviderInviteBlockMessage()` and `redeemInviteOrToast()`. **No changes needed** — only used by sign-in/sign-up pages, already works with both gate states.
- `apps/web/src/features/auth/pages/sign-in.tsx` — **Needs changes:** Line 199 has unconditional `"Use invite"` link text (should be `"Sign up"` when gate off). Lines 202-204 unconditionally render `<RequestInviteDialog>` (should be conditional on `requiresInvite`). Already imports `useInvitesRequired` and computes `requiresInvite`.
- `apps/web/src/features/auth/pages/sign-up.tsx` — **Reference implementation.** Already fully reactive. Shows the pattern: conditional invite code field, conditional OAuth buttons, conditional RequestInviteDialog, conditional subtitle text. **No changes needed.**
- `apps/web/src/features/marketing/pages/marketing.tsx` — **Needs major changes:** Currently zero dynamic behavior. Needs `useInvitesRequired` import, conditional rendering for: header CTA ("Use Invite" → "Sign Up"), badge ("Invite-only launch" → "Now Open" or hidden), hero copy (closed rollout → open registration), CTA buttons ("Sign up with invite" → "Get started free"), secondary CTA ("Already invited?" → "Sign in"), and 3 highlight cards (invite-centric descriptions → open-registration descriptions).
- `apps/web/src/features/admin/pages/admin-invites.tsx` — **Needs additions:** Add `useInvitesRequired` import. Add a status banner at the top showing gate state (enabled/disabled). Error state should show "Unable to determine gate status" per error handling strategy.
- `apps/web/src/features/auth/components/request-invite-dialog.tsx` — **No changes needed.** Used by sign-in and sign-up pages. Already conditionally rendered by sign-up; sign-in needs the same conditional wrapping.
- `apps/web/src/features/auth/hooks/use-invites.test.ts` — Existing tests for `resolveInviteRequirement`. **No changes needed** — tests cover all branches.
- `apps/web/src/features/auth/lib/auth-closed-beta.test.ts` — Existing tests for `getProviderInviteBlockMessage`. **No changes needed** unless interface changes (it won't).

### Hardcoded References Found (Full Sweep)

In `marketing.tsx`:
- Line 11: `"A private launch catalog of family events, classes, and weekend plans."`
- Line 16: `"Explore nearby activities with maps, filters, and saved picks once invited."`
- Line 22: `"Access is limited to invited accounts while the product is still in early rollout."`
- Line 45: `<Link to="/sign-up">Use Invite</Link>`
- Line 55: `"Invite-only launch"` badge
- Line 63: `"Family Events is in a closed rollout. Invited families can sign in to browse"`
- Line 71: `"Sign up with invite"` CTA button
- Line 75: `"Already invited?"` secondary CTA

In `sign-in.tsx`:
- Line 199: `"Use invite"` link text (unconditional)
- Lines 202-204: `<RequestInviteDialog>` (unconditional)

### Build Order

1. **Sign-in page** (smallest change, validates pattern) — wrap RequestInviteDialog and "Use invite" text in `requiresInvite` conditional. Already has the hook.
2. **Marketing page** (biggest change, highest risk) — add `useInvitesRequired` hook, create dual copy sets, conditionally render all UI sections.
3. **Admin invites gate banner** (new component) — add `useInvitesRequired`, render an Alert/Banner at top with gate status text.
4. **Update tests if needed** — existing tests should pass as-is since hook interface is unchanged. May want to add component-level tests for the conditional rendering.

### Verification Approach

- `pnpm --filter @family-events/web check` — TypeScript compilation passes
- `pnpm --filter @family-events/web test` — all 419+ tests pass, no regressions
- `pnpm --filter @family-events/web build` — production build succeeds
- Manual browser verification: with gate enabled (default), sign-up/sign-in/marketing show invite UI; with gate disabled, they show open-registration UI
- Verify admin invites page shows accurate gate status banner in both states

## Constraints

- `useInvitesRequired()` has a 5-minute `staleTime` cache — gate state changes won't be instant across all pages, but this is acceptable for an admin-toggled setting.
- `resolveInviteRequirement` defaults to `true` (gate on) when RPC fails — this is the safe fallback and should not be changed.
- Marketing page error handling: show open-registration copy on RPC failure (per error handling strategy). This differs from auth pages which default to gate-on. Use a separate `resolveMarketingGate()` or inline the logic.
- oxlint + oxfmt are the only formatters — all new code must pass `web:check`.

## Common Pitfalls

- **Marketing page loading state flicker** — `useInvitesRequired` starts with `undefined` data. `resolveInviteRequirement(undefined, false)` returns `true` (gate on). The marketing page would briefly flash closed-beta copy before switching to open-registration copy. Consider showing a neutral/loading state or using the gate-off copy as default for marketing (since that's the target state per D001).
- **Sign-in link text not matching** — The sign-in page bottom says "Don't have an account? Use invite" → when gate is off this should say "Don't have an account? Sign up". Easy to miss because it's at the very bottom of the JSX tree (line 199).
- **Admin banner error state** — Don't show "enabled" or "disabled" when the RPC query errors. Show "Unable to determine gate status" per error handling strategy.

## Skills Discovered

| Technology | Skill | Status |
|------------|-------|--------|
| Supabase | supabase | installed |
| React/Next.js | vercel-react-best-practices | installed |
| React composition | vercel-composition-patterns | installed |
