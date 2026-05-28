# S01: CI Green Baseline and Audit Cleanup — Research

**Date:** 2026-05-28
**Depth:** Light research — known technology, straightforward fixes, all issues reproduced locally.

## Summary

The CI pipeline has **one blocker** and **one tracked stale file**. Format violations mentioned in the milestone context appear to have been resolved already — `web:check` passes cleanly (typecheck, oxlint, oxfmt all green). The single test failure is `supabase/functions/_shared/stock-images.test.ts`, a Deno-only test file that uses `jsr:@std/assert@1` imports but is named with the `.test.ts` convention, causing Vitest to pick it up and fail. One `.orig` file (`unsplash.test.ts.orig`) is tracked in git and should be removed. All other CI commands pass: `packages:check`, `packages:test`, `workspace:test`, and `docs:test` are green. The build succeeds but warns about chunks over 500KB (index at 557KB, recharts at 521KB, maplibre at 1055KB) — those are S04 scope, not S01.

## Recommendation

This is a 2-task slice:

1. **Fix the Deno test naming** — rename `stock-images.test.ts` → `stock-images_test.ts` so Vitest's include pattern (`../../supabase/functions/**/*.test.ts`) no longer picks it up. This is the exact pattern used by every other Deno-only test in the functions directory. The file uses `Deno.test()` and `jsr:@std/assert@1`, confirming it is Deno-only.

2. **Remove stale `.orig` file** — `git rm supabase/functions/_shared/unsplash.test.ts.orig`. This is the only `.orig` file tracked in the repo.

After both changes, `pnpm run web:test` should pass (419 tests, 43 files → 0 failures), and all six CI commands should be green.

## Implementation Landscape

### Key Files

- `supabase/functions/_shared/stock-images.test.ts` — Deno-only test file incorrectly named with `.test.ts` convention. Must be renamed to `stock-images_test.ts`. Uses `jsr:@std/assert@1` and `Deno.test()` — cannot run under Vitest.
- `supabase/functions/_shared/unsplash.test.ts.orig` — Stale merge artifact tracked in git. Must be `git rm`'d.
- `apps/web/vitest.config.ts` — Vitest include pattern: `["src/**/*.test.ts", "../../supabase/functions/**/*.test.ts"]`. This is why `stock-images.test.ts` is picked up. No change needed to this file; the rename fixes the issue.

### Naming Convention Context

The codebase uses two test naming conventions by design:
- `_test.ts` — Deno-only tests (run with `deno test`), use `jsr:@std/assert@1` and `Deno.test()`
- `.test.ts` — Vitest tests (run with `vitest run`), use `vitest` imports (`describe`, `it`, `expect`)

Other `.test.ts` files in `supabase/functions/_shared/` (unsplash, classification, geocode, parsing, url-validation) are legitimate Vitest tests that import from `vitest`. Only `stock-images.test.ts` is the odd one out.

### Build Order

1. Rename `stock-images.test.ts` → `stock-images_test.ts` (unblocks `web:test`)
2. `git rm unsplash.test.ts.orig` (cleanup)
3. Verify all six CI commands pass

These two tasks are independent of each other and can be done in parallel.

### Verification Approach

```bash
# Individual CI commands (all must exit 0):
pnpm run web:check      # typecheck + oxlint + oxfmt
pnpm run web:test        # vitest — 419 tests, 0 failures
pnpm run web:build       # production build (chunk warnings expected, S04 scope)
pnpm run packages:check  # all package typechecks
pnpm run packages:test   # all package tests
pnpm run workspace:test  # 52 workspace guards

# Full pipeline:
pnpm run verify:web      # runs docs:test + workspace:test + packages:check + packages:test + web:check + web:test + web:build
```

## Constraints

- `stock-images.test.ts` must be renamed, not deleted — the tests are valid Deno tests that should continue to work under `deno test`.
- The `.test.ts` vs `_test.ts` split is an intentional convention. Do not change the Vitest include pattern to exclude `_test.ts` — that pattern is already correct.
- `web:build` chunk warnings (index 557KB, recharts 521KB) are **S04 scope** — do not attempt to fix in S01.
- Knip reports 4 "configuration hints" (redundant entry patterns) — these are warnings, not errors, and are not in scope for S01.

## Common Pitfalls

- **Forgetting `git mv` for the rename** — a plain `mv` without staging will cause git to see a delete + add instead of a rename. Use `git mv` to preserve history.
- **Testing only `web:test` after fix** — the acceptance criterion is all six CI commands passing. The rename could theoretically affect workspace guards if any guard inspects test file naming. Run the full `verify:web` pipeline.
