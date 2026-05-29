---
id: S04
parent: M001
milestone: M001
provides:
  - Optimized bundle with all non-exempt chunks under 500KB
  - Full verify:web pass confirming production readiness
requires:
  - slice: S01
    provides: Green CI baseline — all checks pass
  - slice: S02
    provides: Reactive invite gate UI
  - slice: S03
    provides: Disabled invite gate migration
affects:
  []
key_files:
  - apps/web/vite.config.ts
key_decisions:
  - D003: Extract date-fns, @radix-ui, @supabase, and d3 into dedicated manualChunks to bring index and recharts chunks under 500KB
  - Placed d3 check before recharts check in manualChunks to properly extract d3 sub-packages from the recharts bundle
patterns_established:
  - Vite manualChunks ordering: more specific module ID checks must precede broader library checks to ensure proper extraction
observability_surfaces:
  - none — build-time only changes, no runtime diagnostics
drill_down_paths:
  - .gsd/milestones/M001/slices/S04/tasks/T01-SUMMARY.md
  - .gsd/milestones/M001/slices/S04/tasks/T02-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-05-28T07:03:38.552Z
blocker_discovered: false
---

# S04: Bundle Optimization and Final Verification

**Extended manualChunks to extract date-fns, @radix-ui, @supabase, and d3 into dedicated vendor chunks — index dropped from 557KB to 476KB, recharts from 521KB to 458KB — and verify:web passes end-to-end (515 tests, 0 failures)**

## What Happened

This slice delivered the final milestone gate: bundle optimization and full CI verification.

**T01 — manualChunks extraction:** Extended the Vite `manualChunks` configuration in `apps/web/vite.config.ts` to extract four additional vendor dependency groups into dedicated chunks: `date-fns` (23KB), `@radix-ui` (123KB), `@supabase` (199KB), and `d3` sub-packages (63KB). The d3 check was placed before the recharts check so d3 modules used only by recharts would be extracted separately rather than bundled into the recharts chunk. This reduced the index chunk from 557KB to 476KB and the recharts chunk from 521KB to 458KB — both now under the 500KB threshold. The only chunk exceeding 500KB is maplibre at 1055KB, which is exempt as an inherently large WebGL renderer.

**T02 — Full verify:web pipeline:** Ran `pnpm run verify:web` which executes all 7 CI steps sequentially: docs:test → workspace:test → packages:check → packages:test → web:check → web:test → web:build. All steps passed with exit code 0. 515 total tests across all suites, 0 failures. The bundle preload budget guard (part of workspace:test) confirmed total preload ≤1MB with no forbidden preloads. The build step confirmed all chunk sizes are within limits.

No runtime code was changed — only build-time chunk splitting configuration in vite.config.ts.

## Verification

**Build verification (gsd_exec c131e7a0):**
- index chunk: 476.13KB ✅ (was 557KB, target <500KB)
- recharts chunk: 457.86KB ✅ (was 521KB, target <500KB)
- sentry chunk: 467.14KB ✅ (<500KB)
- maplibre chunk: 1054.75KB ⚠️ (exempt — inherently large WebGL renderer)
- New vendor chunks: date-fns 22.91KB, d3 62.90KB, radix-ui 122.67KB, supabase 198.94KB

**Full pipeline verification (gsd_exec 4c36642d):**
- `pnpm run verify:web` exit code: 0
- All 7 steps passed: docs:test, workspace:test, packages:check, packages:test, web:check, web:test, web:build
- 515 total tests, 0 failures
- Bundle preload budget guard: passed (total preload ≤1MB, no forbidden preloads)
- Duration: 59s

## Requirements Advanced

- R010 — All production chunks now under 500KB except maplibre (exempt). Index: 557→476KB, recharts: 521→458KB.
- R011 — 515 tests pass with 0 failures across all test suites.
- R012 — verify:web exits 0 end-to-end — all 7 pipeline steps pass.

## Requirements Validated

- R010 — Build output shows index 476KB, recharts 458KB, sentry 467KB — all <500KB. Only maplibre exceeds (exempt).
- R011 — verify:web runs all test suites: 515 tests, 0 failures, exit code 0.
- R012 — pnpm run verify:web exits 0 in 59s, all 7 steps pass.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Operational Readiness

None.

## Deviations

None.

## Known Limitations

The sentry chunk (467KB) is close to the 500KB threshold and may exceed it if the Sentry SDK grows in future updates. The maplibre chunk at 1055KB remains the largest chunk but is exempt as an inherently large WebGL renderer that cannot be meaningfully split.

## Follow-ups

None.

## Files Created/Modified

- `apps/web/vite.config.ts` — Extended manualChunks to extract date-fns, @radix-ui, @supabase, and d3 into dedicated vendor chunks
