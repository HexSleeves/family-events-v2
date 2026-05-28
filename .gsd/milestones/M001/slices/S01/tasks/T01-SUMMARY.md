---
id: T01
parent: S01
milestone: M001
key_files:
  - supabase/functions/_shared/stock-images_test.ts
key_decisions:
  - Used git mv (not plain mv) to preserve file history
  - Followed _test.ts vs .test.ts convention per MEM004
duration: 
verification_result: passed
completed_at: 2026-05-28T04:20:07.629Z
blocker_discovered: false
---

# T01: Renamed Deno test to _test.ts convention and removed stale .orig merge artifact so Vitest no longer picks up Deno-only tests

**Renamed Deno test to _test.ts convention and removed stale .orig merge artifact so Vitest no longer picks up Deno-only tests**

## What Happened

Executed `git mv` to rename `supabase/functions/_shared/stock-images.test.ts` → `stock-images_test.ts`, switching from the `.test.ts` (Vitest) naming convention to `_test.ts` (Deno) convention. This prevents Vitest's include pattern `../../supabase/functions/**/*.test.ts` from picking up a Deno-only test file that imports `jsr:@std/assert@1` and uses `Deno.test()`.

Ran `git rm` to remove the stale tracked merge artifact `unsplash.test.ts.orig`.

Verified: renamed file exists, original files are gone, and `pnpm run web:test` passes with 43 test files / 419 tests / 0 failures.

## Verification

Ran `pnpm run web:test` — all 43 test files passed, 419 tests passed, 0 failures, exit code 0. Confirmed `stock-images_test.ts` exists, `stock-images.test.ts` and `unsplash.test.ts.orig` do not exist via `ls` checks.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `git mv supabase/functions/_shared/stock-images.test.ts supabase/functions/_shared/stock-images_test.ts` | 0 | ✅ pass | 84ms |
| 2 | `git rm supabase/functions/_shared/unsplash.test.ts.orig` | 0 | ✅ pass | 84ms |
| 3 | `pnpm run web:test` | 0 | ✅ pass (43 files, 419 tests, 0 failures) | 2197ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `supabase/functions/_shared/stock-images_test.ts`
