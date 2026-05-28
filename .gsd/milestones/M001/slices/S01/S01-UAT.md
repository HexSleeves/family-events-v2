# S01: CI Green Baseline and Audit Cleanup — UAT

**Milestone:** M001
**Written:** 2026-05-28T06:25:40.973Z

# S01: CI Green Baseline and Audit Cleanup — UAT

**Milestone:** M001
**Written:** 2025-05-28

## UAT Type

- UAT mode: artifact-driven
- Why this mode is sufficient: This slice only renames/removes files and verifies CI commands — no runtime behavior or UI changes.

## Preconditions

- Repository checked out with T01 changes applied (rename + removal)
- Node dependencies installed (`pnpm install` completed)

## Smoke Test

Run `pnpm run verify:web` — should exit 0 with no test failures.

## Test Cases

### 1. Deno test file renamed correctly

1. Check `supabase/functions/_shared/stock-images_test.ts` exists
2. Check `supabase/functions/_shared/stock-images.test.ts` does NOT exist
3. **Expected:** Renamed file present, old file absent

### 2. Stale .orig artifact removed

1. Check `supabase/functions/_shared/unsplash.test.ts.orig` does NOT exist
2. Run `find . -name '*.orig' -not -path './.git/*' -not -path '*/node_modules/*'`
3. **Expected:** No tracked .orig files found

### 3. web:test passes with zero failures

1. Run `pnpm run web:test`
2. **Expected:** All test files pass, 0 failures. No Deno-only test files are picked up by Vitest.

### 4. Full CI pipeline green

1. Run `pnpm run verify:web`
2. **Expected:** Exit code 0. All seven steps (docs:test, workspace:test, packages:check, packages:test, web:check, web:test, web:build) pass.

## Edge Cases

### Deno test content unchanged

1. Open `supabase/functions/_shared/stock-images_test.ts`
2. Verify it still uses `Deno.test()` and `jsr:@std/assert@1`
3. **Expected:** File content is identical to the pre-rename version — only the filename changed.

## Failure Signals

- `pnpm run verify:web` exits non-zero
- `web:test` reports failures from Deno test files (JSR import errors)
- `stock-images.test.ts` still exists at old path

## Not Proven By This UAT

- Bundle size optimization (S04 scope)
- Invite gate UI behavior (S02 scope)
- Runtime behavior of any application feature — this is purely a CI/build hygiene slice

## Notes for Tester

- Build chunk-size warnings (index ~557KB, recharts ~521KB, maplibre ~1055KB) are expected and will be addressed in S04.
- The `verify:web` pipeline takes ~4 minutes wall time.
