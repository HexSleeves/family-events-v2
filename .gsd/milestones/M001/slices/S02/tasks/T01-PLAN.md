---
estimated_steps: 9
estimated_files: 1
skills_used: []
---

# T01: Make sign-in page conditionally render invite UI based on gate state

**Why:** The sign-in page (sign-in.tsx) already imports `useInvitesRequired` and computes `requiresInvite`, but unconditionally renders `<RequestInviteDialog>` at line 203 and hardcodes "Use invite" link text at line 199. When the gate is disabled, users see confusing invite-related UI on a page that should show clean open-registration experience. Satisfies R004.

**Do:**
1. Read `apps/web/src/features/auth/pages/sign-in.tsx` and `apps/web/src/features/auth/pages/sign-up.tsx` (reference implementation).
2. In sign-in.tsx, wrap the `<RequestInviteDialog>` render (currently at bottom of JSX, around line 203) in a `{requiresInvite && ...}` conditional guard — matching the sign-up page pattern.
3. Change the bottom link text from hardcoded `"Use invite"` to `{requiresInvite ? "Use invite" : "Sign up"}` — the surrounding `<Link to="/sign-up">` stays the same.
4. Run `pnpm --filter @family-events/web check` to verify TypeScript compiles.
5. Run `pnpm --filter @family-events/web test` to verify no test regressions.
6. Ensure code passes oxlint/oxfmt formatting via `web:check`.

**Done when:** sign-in.tsx conditionally renders RequestInviteDialog and link text based on `requiresInvite`. TypeScript compiles clean. All existing tests pass.

## Inputs

- `apps/web/src/features/auth/pages/sign-in.tsx`
- `apps/web/src/features/auth/pages/sign-up.tsx`
- `apps/web/src/features/auth/hooks/use-invites.ts`

## Expected Output

- `apps/web/src/features/auth/pages/sign-in.tsx`

## Verification

pnpm --filter @family-events/web check && pnpm --filter @family-events/web test

## Observability Impact

None — no new signals. Existing requiresInvite logic unchanged.
