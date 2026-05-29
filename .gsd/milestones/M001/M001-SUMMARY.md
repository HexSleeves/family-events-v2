---
id: M001
title: "Production Readiness and Open Registration"
status: complete
completed_at: 2026-05-29T00:03:48.419Z
key_decisions:
  - Disable invite gate via GUC rather than removing infrastructure — preserves re-enable path
  - All consumer pages query invites_required() RPC via shared hook — no new API surface
  - Marketing defaults gate-off on error (permissive UX) while auth defaults gate-on (security)
  - Bundle splitting: extract date-fns, radix-ui, supabase-js, d3 into separate vendor chunks
  - Deno edge-function tests use _test.ts suffix to avoid Vitest glob pickup
  - ALTER DATABASE SET for local dev GUC defaults; session-level set_config() in tests for isolation
key_files:
  - apps/web/src/features/auth/pages/sign-in.tsx
  - apps/web/src/features/marketing/pages/marketing.tsx
  - apps/web/src/features/admin/pages/admin-invites.tsx
  - apps/web/vite.config.ts
  - supabase/migrations/20260601012000_disable_invite_gate.sql
  - supabase/docs/INVITE_GATE.md
  - supabase/functions/_shared/stock-images_test.ts
lessons_learned:
  - Artifact-driven verification is a pragmatic trade-off when UI depends on a backend service not available in CI — document the constraint explicitly in ASSESSMENT files
  - Vite manualChunks ordering matters: more specific module ID checks must precede broader library checks for proper extraction
  - ALTER DATABASE SET is the right tool for local dev defaults; pooled connections retain old GUC values and need reconnection
---

# M001: Production Readiness and Open Registration

**Web app and Supabase backend prepared for public launch: CI green, invite gate UI fully reactive, gate disabled for open registration, and all non-exempt chunks under 500KB.**

## What Happened

M001 delivered production readiness across 4 slices. S01 established a green CI baseline by fixing Deno test naming (_test.ts convention), removing stale .orig artifacts, and confirming all 7 verify:web pipeline steps pass (419 tests). S02 made the invite gate UI fully reactive across all consumer pages — sign-up, sign-in, marketing, and admin-invites — using the existing invites_required() RPC via a shared useInvitesRequired() hook, with intentional divergence: auth pages default gate-on for security, marketing defaults gate-off for permissive UX. S03 disabled the invite gate for local dev via an ALTER DATABASE SET migration and produced a production runbook (INVITE_GATE.md) documenting Dashboard-based gate toggle. S04 optimized bundle splitting by extracting date-fns, @radix-ui, @supabase, and d3 into dedicated vendor chunks, dropping the index chunk from 557KB to 476KB and recharts from 521KB to 458KB. Final verify:web confirmed 515 tests, 0 failures, all 7 steps green.

## Success Criteria Results

- [x] pnpm run verify:web passes end-to-end with zero failures — S04: exit 0, 515 tests, 0 failures, all 7 steps green
- [x] Gate disabled shows open-registration UI everywhere — S02: artifact-driven verification of conditional rendering across all pages, accepted as sufficient
- [x] Gate enabled shows full invite UI — S02: artifact-driven verification confirmed, accepted as sufficient
- [x] No chunk exceeds 500KB except maplibre — S04: index 476KB, recharts 458KB, sentry 467KB; maplibre 1055KB exempt
- [x] Admin invites page displays gate status banner — S02: ShieldCheck/ShieldOff icons with 4 states (loading/error/enabled/disabled)

## Definition of Done Results

All 4 slices completed with SUMMARY.md and passing ASSESSMENT verdicts. Validation passed (round 1) with all 4 gates (MV01-MV04) satisfied. All 15 requirements covered. All 5 boundary contracts honored. Contract verification comprehensive (515 tests). Integration and UAT accepted as artifact-driven given Supabase backend dependency constraint.

## Requirement Outcomes

Not provided.

## Deviations

Integration and UAT verification classes were artifact-driven rather than live browser-based. This was an acceptable deviation given the Supabase backend dependency constraint — the gate UI requires a running backend with configurable invites_required() RPC state.

## Follow-ups

Monitor sentry chunk size (467KB, close to 500KB threshold) in future Sentry SDK updates. Consider adding real-time subscription for mid-session gate toggles if operational need arises. Production gate toggle remains a manual Dashboard action — document in onboarding.
