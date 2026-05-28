# S02: Reactive Invite Gate UI — UAT

**Milestone:** M001
**Written:** 2026-05-28T06:43:00.442Z

# S02: Reactive Invite Gate UI — UAT

**Milestone:** M001
**Written:** 2026-05-28

## UAT Type

- UAT mode: artifact-driven
- Why this mode is sufficient: All three consumer pages verified via TypeScript compilation (type safety), 419 passing unit tests (behavioral correctness), and production build (no runtime errors). Conditional rendering logic is straightforward ternary/short-circuit patterns. Full browser UAT would require Supabase backend with configurable gate state.

## Preconditions

- Repository cloned and dependencies installed (`pnpm install`)
- `pnpm --filter @family-events/web check` passes
- `pnpm --filter @family-events/web test` passes with 419+ tests
- `pnpm --filter @family-events/web build` succeeds

## Smoke Test

Run `pnpm --filter @family-events/web check && pnpm --filter @family-events/web test && pnpm --filter @family-events/web build` — all three commands exit 0.

## Test Cases

### 1. Sign-in page hides invite UI when gate is off

1. Ensure `invites_required()` RPC returns `false` (gate disabled)
2. Navigate to `/sign-in`
3. Look at bottom of sign-in form for account link
4. **Expected:** Link text reads "Sign up" (not "Use invite"). No `RequestInviteDialog` is visible anywhere on the page.

### 2. Sign-in page shows invite UI when gate is on

1. Ensure `invites_required()` RPC returns `true` (gate enabled)
2. Navigate to `/sign-in`
3. **Expected:** Link text reads "Use invite". `RequestInviteDialog` renders below the sign-in form.

### 3. Marketing page shows open-registration copy when gate is off

1. Ensure `invites_required()` RPC returns `false`
2. Navigate to `/` (marketing page)
3. **Expected:** Badge reads "Open Access" (not "Invite-only launch"). Header CTA says "Get Started". Hero text describes open registration. Bottom CTAs say "Get started free" and "Sign in". Highlight cards show open-access descriptions.

### 4. Marketing page shows closed-beta copy when gate is on

1. Ensure `invites_required()` RPC returns `true`
2. Navigate to `/`
3. **Expected:** Badge reads "Invite-only launch". Header CTA says "Use Invite". Hero mentions closed rollout. CTAs reference invite codes. Highlight cards show invite-centric descriptions.

### 5. Admin invites page shows gate status banner

1. Navigate to `/admin/invites` as an admin user
2. **Expected:** A banner appears above the invites table showing either:
   - "Invite gate: Enabled" with green ShieldCheck icon and default Badge, OR
   - "Invite gate: Disabled" with ShieldOff icon and outline Badge
3. While RPC is loading: spinner with "Checking gate status…"
4. On RPC error: AlertTriangle with "Unable to determine gate status"

## Edge Cases

### Marketing page on RPC error

1. Simulate `invites_required()` RPC failure (network error or timeout)
2. Navigate to marketing page
3. **Expected:** Page renders open-registration copy (defaults to gate-off on error to avoid blocking user acquisition)

### Sign-in page on RPC error

1. Simulate `invites_required()` RPC failure
2. Navigate to sign-in page
3. **Expected:** Page renders invite UI (defaults to gate-on via `resolveInviteRequirement()` for security)

### Admin page manages codes regardless of gate state

1. With gate disabled, navigate to admin invites
2. **Expected:** Banner shows "Disabled" but all invite code management features remain fully functional

## Failure Signals

- Sign-in page shows "Use invite" text when gate is disabled
- Marketing page shows "Invite-only launch" badge when gate is disabled
- Admin invites page has no banner or shows incorrect gate state
- TypeScript compilation errors in sign-in.tsx, marketing.tsx, or admin-invites.tsx
- Test failures in any of the 419 tests

## Not Proven By This UAT

- Live browser rendering with actual Supabase backend (artifact-driven verification only)
- Real-time gate toggling mid-session (would require WebSocket/polling, not in scope)
- Mobile responsive layout of new marketing copy variants
- Performance impact of additional RPC call on marketing page load

## Notes for Tester

- The marketing page intentionally defaults to open-registration on RPC error (permissive) while auth pages default to gate-on (restrictive). This is a deliberate security/UX tradeoff.
- Sign-up page was NOT modified — it already had the correct conditional rendering pattern and serves as the reference implementation.
- Chunk size warnings in build output are pre-existing and tracked for S04 (Bundle Optimization).
