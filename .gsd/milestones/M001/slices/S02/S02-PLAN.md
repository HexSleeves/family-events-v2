# S02: Reactive Invite Gate UI

**Goal:** Sign-up, sign-in, marketing page, and admin invites all respond to the invites_required() RPC. Gate disabled shows open-registration UI everywhere; gate enabled shows full invite UI.
**Demo:** After this: sign-up, sign-in, marketing page, and admin invites all respond to invites_required() RPC. Gate disabled shows open-registration UI everywhere; gate enabled shows full invite UI.

## Must-Haves

- `pnpm --filter @family-events/web check` passes (TypeScript clean)
- `pnpm --filter @family-events/web test` passes all 419+ tests with zero failures
- `pnpm --filter @family-events/web build` succeeds
- Sign-in page: when gate off, bottom link says "Sign up" (not "Use invite") and RequestInviteDialog is hidden
- Marketing page: when gate off, header CTA says "Get Started", badge hidden, hero copy says open-registration, CTAs say "Get started free" and "Sign in"
- Marketing page: when gate on, all closed-beta copy renders (invite-only badge, invite CTAs, closed rollout paragraph)
- Admin invites page: shows a banner with current gate state (enabled/disabled) or error message
- R002, R003, R004, R005 requirements satisfied

## Proof Level

- This slice proves: Integration — UI components conditionally render based on live RPC hook state. Verified via TypeScript compilation, existing unit tests, and production build. Full browser UAT deferred to slice completion.

## Integration Closure

Upstream consumed: `useInvitesRequired()` hook and `resolveInviteRequirement()` helper from `apps/web/src/features/auth/hooks/use-invites.ts` (unchanged). Sign-up page pattern is the reference implementation. New wiring: marketing.tsx gains useInvitesRequired import; admin-invites.tsx gains useInvitesRequired import and gate status banner. After this slice, S03 can disable the gate and all consumer pages will correctly show open-registration UI.

## Verification

- Admin invites page gains a visible gate status banner showing enabled/disabled/error state — this is the primary diagnostic surface for gate state. No new logging or metrics.

## Tasks

- [x] **T01: Make sign-in page conditionally render invite UI based on gate state** `est:15m`
  **Why:** The sign-in page (sign-in.tsx) already imports `useInvitesRequired` and computes `requiresInvite`, but unconditionally renders `<RequestInviteDialog>` at line 203 and hardcodes "Use invite" link text at line 199. When the gate is disabled, users see confusing invite-related UI on a page that should show clean open-registration experience. Satisfies R004.
  - Files: `apps/web/src/features/auth/pages/sign-in.tsx`
  - Verify: pnpm --filter @family-events/web check && pnpm --filter @family-events/web test

- [x] **T02: Make marketing page reactive to invite gate state with dual copy sets** `est:30m`
  **Why:** The marketing page (marketing.tsx, 100 lines) is entirely hardcoded with closed-beta language: "Invite-only launch" badge, "closed rollout" paragraph, "Sign up with invite" CTA, "Already invited?" button, and three highlight cards with invite-centric descriptions. It does not import `useInvitesRequired` at all. New users see invite-only messaging even when registration is open. This is the highest-impact change in S02. Satisfies R003.
  - Files: `apps/web/src/features/marketing/pages/marketing.tsx`
  - Verify: pnpm --filter @family-events/web check && pnpm --filter @family-events/web test

- [ ] **T03: Add gate status banner to admin invites page** `est:20m`
  **Why:** The admin invites page manages invite codes and requests but provides no visibility into whether the invite gate is currently enabled or disabled. Admins need to know the current gate state to understand whether the codes they manage are actively required. Satisfies R005.
  - Files: `apps/web/src/features/admin/pages/admin-invites.tsx`
  - Verify: pnpm --filter @family-events/web check && pnpm --filter @family-events/web test && pnpm --filter @family-events/web build

## Files Likely Touched

- apps/web/src/features/auth/pages/sign-in.tsx
- apps/web/src/features/marketing/pages/marketing.tsx
- apps/web/src/features/admin/pages/admin-invites.tsx
