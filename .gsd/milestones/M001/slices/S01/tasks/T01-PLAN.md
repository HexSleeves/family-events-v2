---
estimated_steps: 12
estimated_files: 3
skills_used: []
---

# T01: Rename Deno test file and remove stale .orig artifact

**Why:** The file `supabase/functions/_shared/stock-images.test.ts` is a Deno-only test (uses `jsr:@std/assert@1` and `Deno.test()`) but is named with the `.test.ts` convention, causing the Vitest include pattern `../../supabase/functions/**/*.test.ts` to pick it up and fail. The stale `unsplash.test.ts.orig` file is a tracked merge artifact that should be removed.

**Do:**
1. Run `git mv supabase/functions/_shared/stock-images.test.ts supabase/functions/_shared/stock-images_test.ts` to rename the Deno test file, preserving git history.
2. Run `git rm supabase/functions/_shared/unsplash.test.ts.orig` to remove the stale merge artifact.
3. Verify the rename worked: confirm `stock-images_test.ts` exists and `stock-images.test.ts` does not.
4. Run `pnpm run web:test` to confirm Vitest no longer picks up the Deno test file and all tests pass (0 failures).

**Constraints:**
- Use `git mv`, not plain `mv`, to preserve history.
- Do NOT modify `apps/web/vitest.config.ts` — the Vitest include pattern is correct as-is.
- Do NOT delete `stock-images_test.ts` — it contains valid Deno tests.
- The `_test.ts` vs `.test.ts` split is intentional project convention (MEM004).

**Done when:** `stock-images_test.ts` exists, `stock-images.test.ts` and `unsplash.test.ts.orig` do not exist, and `pnpm run web:test` exits 0.

## Inputs

- `supabase/functions/_shared/stock-images.test.ts`
- `supabase/functions/_shared/unsplash.test.ts.orig`

## Expected Output

- `supabase/functions/_shared/stock-images_test.ts`

## Verification

pnpm run web:test
