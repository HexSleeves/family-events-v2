---
id: S01
parent: M001
milestone: M001
provides:
  - Green CI baseline — all seven check commands pass with zero failures
  - Clean codebase — stale files removed, Deno test naming fixed
requires:
  []
affects:
  - S02
  - S04
key_files:
  - supabase/functions/_shared/stock-images_test.ts
key_decisions:
  - Used git mv (not plain mv) to preserve file history for the Deno test rename
  - Followed _test.ts convention for Deno tests to avoid Vitest glob collision
  - Chunk size warnings acknowledged as S04 scope, not S01 blockers
patterns_established:
  - Deno edge-function tests use _test.ts suffix to avoid Vitest pickup
observability_surfaces:
  - none
drill_down_paths:
  []
duration: ""
verification_result: passed
completed_at: 2026-05-28T06:25:40.973Z
blocker_discovered: false
---

# S01: CI Green Baseline and Audit Cleanup

**Renamed Deno test to _test.ts convention, removed stale .orig artifact, and verified all seven CI pipeline steps pass with zero failures**

## What Happened

This slice established the green CI baseline required by all downstream slices.\n\n**T01 — Rename and cleanup:** Used `git mv` to rename `stock-images.test.ts` → `stock-images_test.ts` so the Deno-only test (which uses `jsr:@std/assert@1` and `Deno.test()`) is no longer matched by Vitest's `**/*.test.ts` glob. Removed the stale `unsplash.test.ts.orig` merge artifact from tracking. After this, `web:test` passed all 43 test files (419 tests, 0 failures).\n\n**T02 — Full pipeline verification:** Ran `pnpm run verify:web` end-to-end. All seven steps passed: docs:test (52 tests), workspace:test, packages:check (tsc across contracts/shared/design-system/email/deploy-cli), packages:test, web:check, web:test, web:build. Build completed with chunk-size warnings for index (~557KB), recharts (~521KB), and maplibre (~1055KB) — these are expected and scoped to S04 bundle optimization.

## Verification

**File-level checks:**\n- `stock-images_test.ts` exists at expected path ✅\n- `stock-images.test.ts` removed ✅\n- `unsplash.test.ts.orig` removed ✅\n- No tracked `.orig` files in repo (only one inside `node_modules/.deno/` — dependency artifact, not tracked) ✅\n\n**Full CI pipeline (`pnpm run verify:web`):** Exit code 0 ✅\n- docs:test — 52 tests passed\n- workspace:test — passed\n- packages:check — tsc --noEmit passed for all 5 packages\n- packages:test — passed\n- web:check — passed\n- web:test — 43 files, 419 tests, 0 failures\n- web:build — completed (chunk warnings are S04 scope)

## Requirements Advanced

- R001 — All six CI check commands now exit 0 — zero format violations, zero test failures
- R008 — stock-images.test.ts renamed to stock-images_test.ts; Vitest no longer picks up Deno-only tests
- R009 — unsplash.test.ts.orig removed; no tracked .orig files remain

## Requirements Validated

- R001 — pnpm run verify:web exits 0 — all seven CI steps pass
- R008 — web:test passes 43 files / 419 tests / 0 failures with no Deno test pickup
- R009 — find confirms no tracked .orig files; stale artifact removed

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Operational Readiness

None.

## Deviations

None.

## Known Limitations

Build produces three chunks over 500KB (index ~557KB, recharts ~521KB, maplibre ~1055KB). These are deferred to S04 bundle optimization.

## Follow-ups

None.

## Files Created/Modified

- `supabase/functions/_shared/stock-images_test.ts` — Renamed from stock-images.test.ts — Deno test now uses _test.ts convention
- `supabase/functions/_shared/stock-images.test.ts` — Removed (renamed to _test.ts)
- `supabase/functions/_shared/unsplash.test.ts.orig` — Removed stale merge artifact from tracking
