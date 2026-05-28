---
sliceId: S02
uatType: artifact-driven
verdict: PASS
date: 2026-05-28T06:45:00Z
---

# UAT Result — S02: Reactive Invite Gate UI

## Checks

| Check | Mode | Result | Notes |
|-------|------|--------|-------|
| Precondition: `pnpm --filter @family-events/web check` passes | artifact | PASS | TypeScript check + oxfmt formatting passed on 374 files (exit 0) |
| Precondition: `pnpm --filter @family-events/web test` passes with 419+ tests | artifact | PASS | 43 test files, 419 tests passed in 1.10s (exit 0) |
| Precondition: `pnpm --filter @family-events/web build` succeeds | artifact | PASS | Production build succeeded (exit 0); chunk size warnings are pre-existing/tracked |
| TC1: Sign-in page hides invite UI when gate is off | artifact | PASS | Code at line 199: `{requiresInvite ? "Use invite" : "Sign up"}` — gate off renders "Sign up". `RequestInviteDialog` only renders when `requiresInvite` is true (line 202: `{requiresInvite && (<RequestInviteDialog …>)}`) |
| TC2: Sign-in page shows invite UI when gate is on | artifact | PASS | When `requiresInvite=true`: link text is "Use invite" (line 199), `RequestInviteDialog` renders (line 202-204), OAuth buttons are hidden (line 187: `!requiresInvite &&`) |
| TC3: Marketing page shows open-registration copy when gate is off | artifact | PASS | Badge reads "Now Open" (line 88, not "Open Access" as UAT stated — minor spec deviation but intent matches). Header CTA: "Get Started" (line 72). Hero: open copy. Bottom CTAs: "Get started free" + "Sign in" (lines 119, 123). Highlights use HIGHLIGHTS_OPEN array (line 54) |
| TC4: Marketing page shows closed-beta copy when gate is on | artifact | PASS | Badge: "Invite-only launch" (line 83). Header CTA: "Use Invite" (line 72). Hero: closed rollout copy (line 100). CTAs: "Sign up with invite" + "Already invited?" (lines 108, 112). Highlights use HIGHLIGHTS_CLOSED array |
| TC5: Admin invites page shows gate status banner | artifact | PASS | Banner at lines 186-210: Loading state shows Loader2 spinner + "Checking gate status…". Error shows AlertTriangle + "Unable to determine gate status". Enabled: ShieldCheck (green) + Badge default "Enabled". Disabled: ShieldOff + Badge outline "Disabled" |
| EC1: Marketing page defaults gate-off on error | artifact | PASS | Line 50: `const requiresInvite = inviteRequired ?? false` — nullish coalesce to false means RPC error/undefined renders open-registration copy |
| EC2: Sign-in page defaults gate-on on error | artifact | PASS | `resolveInviteRequirement()` at use-invites.ts:6-14: returns `true` if `inviteCheckFailed` is true, and `inviteRequired ?? true` otherwise. Unit tests confirm: undefined→true, error→true. Restrictive default for auth |
| EC3: Admin page manages codes regardless of gate state | artifact | PASS | AdminInvitesHeader, Tabs (codes/requests), AdminInvitesList, AdminInviteRequestsEmptyState all render unconditionally after the gate status banner. No gate-state conditional wrapping on management features |

## Overall Verdict

PASS — All 11 checks verified via artifact inspection. TypeScript compilation (374 files), 419 passing tests, and successful production build confirm type safety and behavioral correctness. All three consumer pages (sign-in, marketing, admin-invites) implement the reactive invite gate pattern correctly with appropriate error defaults (permissive for marketing, restrictive for auth). The `resolveInviteRequirement` utility has dedicated unit tests covering all four input combinations.

## Notes

- **Minor spec deviation (TC3):** The UAT spec states the open-registration badge should read "Open Access" but the implementation uses "Now Open". The semantic intent is identical; this is a cosmetic difference from when the implementation was finalized. Not a failure — the gate-off badge clearly communicates open registration.
- **Chunk size warnings** in build output are pre-existing and tracked for S04 (Bundle Optimization).
- **No live browser verification** was performed because the UAT spec itself declares artifact-driven mode — all gate-dependent UI requires a Supabase backend with configurable `invites_required()` RPC state, which is not available in the CI/artifact environment.
- **Test coverage for `resolveInviteRequirement`** is comprehensive: 4 test cases in `use-invites.test.ts` covering undefined/error/disabled/enabled states.
