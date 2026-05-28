# S01: CI Green Baseline and Audit Cleanup

**Goal:** All six CI check commands (web:check, web:test, web:build, packages:check, packages:test, workspace:test) pass with zero failures. Stale files removed, Deno test naming fixed.
**Demo:** After this: all six CI check commands (web:check, web:test, web:build, packages:check, packages:test, workspace:test) pass with zero failures. Stale files removed, Deno test naming fixed.

## Must-Haves

- `pnpm run verify:web` exits 0 (runs docs:test, workspace:test, packages:check, packages:test, web:check, web:test, web:build)
- `stock-images.test.ts` renamed to `stock-images_test.ts` (Deno convention, no longer picked up by Vitest)
- `unsplash.test.ts.orig` removed from git tracking
- web:test reports 0 failures across all test files

## Proof Level

- This slice proves: operational — real CI commands run against actual codebase

## Integration Closure

- Upstream surfaces consumed: none (first slice)
- New wiring introduced: none — file rename and removal only
- What remains: S02 (reactive invite gate UI), S03 (disable gate), S04 (bundle optimization)

## Verification

- Run the task and slice verification checks for this slice.

## Tasks

- [x] **T01: Rename Deno test file and remove stale .orig artifact** `est:10m`
  **Why:** The file `supabase/functions/_shared/stock-images.test.ts` is a Deno-only test (uses `jsr:@std/assert@1` and `Deno.test()`) but is named with the `.test.ts` convention, causing the Vitest include pattern `../../supabase/functions/**/*.test.ts` to pick it up and fail. The stale `unsplash.test.ts.orig` file is a tracked merge artifact that should be removed.
  - Files: `supabase/functions/_shared/stock-images.test.ts`, `supabase/functions/_shared/stock-images_test.ts`, `supabase/functions/_shared/unsplash.test.ts.orig`
  - Verify: pnpm run web:test

- [x] **T02: Verify full CI pipeline passes with zero failures** `est:15m`
  **Why:** The acceptance criterion for S01 is all six CI commands passing, not just web:test. The rename could theoretically affect workspace guards or other checks. This task runs the full `verify:web` pipeline to confirm green baseline.
  - Verify: pnpm run verify:web

## Files Likely Touched

- supabase/functions/_shared/stock-images.test.ts
- supabase/functions/_shared/stock-images_test.ts
- supabase/functions/_shared/unsplash.test.ts.orig
