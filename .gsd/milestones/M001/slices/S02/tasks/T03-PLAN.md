---
estimated_steps: 17
estimated_files: 1
skills_used: []
---

# T03: Add gate status banner to admin invites page

**Why:** The admin invites page manages invite codes and requests but provides no visibility into whether the invite gate is currently enabled or disabled. Admins need to know the current gate state to understand whether the codes they manage are actively required. Satisfies R005.

**Do:**
1. Read `apps/web/src/features/admin/pages/admin-invites.tsx` fully.
2. Read `apps/web/src/features/auth/hooks/use-invites.ts` for the `useInvitesRequired` interface.
3. Check available UI components: Badge (already used in this file), Card/CardContent, or a simple styled div. There is no standalone Alert component — use Badge with appropriate variant or a simple div with border/bg styling.
4. Import `useInvitesRequired` from `@/features/auth/hooks/use-invites` (note: `useAdminInviteCodes`, `useCreateInviteCode`, `useDeleteInviteCode` are already imported from this module).
5. At the top of `AdminInvitesPage`, call `useInvitesRequired()` and destructure `{ data: inviteRequired, isLoading: gateLoading, isError: gateError }`.
6. Add a gate status banner above `<AdminInvitesHeader>` in the JSX return. Three states:
   - **Loading:** Show a muted/skeleton text like "Checking gate status…" or a small loading indicator.
   - **Error:** Show "Unable to determine gate status" in a warning/muted style.
   - **Loaded:** Show "Invite gate: enabled" (with a green or primary badge) or "Invite gate: disabled" (with a secondary/outline badge). Use the Badge component already imported.
7. The banner should be a simple horizontal bar — not a modal or dialog. Keep it compact: a single line with icon + text + badge.
8. Import `ShieldCheck` or `Info` icon from lucide-react if desired for the banner (lucide-react is already a dependency used throughout).
9. Run `pnpm --filter @family-events/web check` and `pnpm --filter @family-events/web test`.
10. Ensure oxlint/oxfmt formatting passes.
11. Run `pnpm --filter @family-events/web build` as final verification that production build succeeds with all three page changes.

**Done when:** Admin invites page shows a gate status banner with enabled/disabled/error state. TypeScript compiles clean. All tests pass. Production build succeeds.

## Inputs

- `apps/web/src/features/admin/pages/admin-invites.tsx`
- `apps/web/src/features/auth/hooks/use-invites.ts`
- `apps/web/src/shared/components/ui/badge.tsx`

## Expected Output

- `apps/web/src/features/admin/pages/admin-invites.tsx`

## Verification

pnpm --filter @family-events/web check && pnpm --filter @family-events/web test && pnpm --filter @family-events/web build

## Observability Impact

Admin invites page now surfaces gate state as a visible banner — primary diagnostic surface for whether invite codes are actively required.
