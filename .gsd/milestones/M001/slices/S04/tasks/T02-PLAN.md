---
estimated_steps: 17
estimated_files: 2
skills_used: []
---

# T02: Run full verify:web pipeline as final pre-launch gate

**Why:** R012 requires `pnpm run verify:web` to pass end-to-end as the final gate before launch. This runs all 7 CI steps: docs:test, workspace:test, packages:check, packages:test, web:check, web:test, web:build. The bundle budget guard (web-bundle-budget.test.mjs) runs as part of workspace:test and validates preload budget ≤1MB and no forbidden preloads. The build step validates chunk sizes.

**Do:**
1. Run `pnpm run verify:web` and capture full output.
2. Verify all 7 steps pass with exit code 0.
3. Specifically confirm:
   - docs:test passes (52+ tests)
   - workspace:test passes (includes bundle budget guard)
   - packages:check passes (tsc across 5 packages)
   - packages:test passes
   - web:check passes
   - web:test passes (43+ files, 419+ tests)
   - web:build passes with only maplibre chunk warning
4. If any step fails, diagnose and fix. Common failure modes:
   - Bundle budget guard fails due to preload budget >1MB → check new chunk preload totals
   - web:test regression → unrelated to chunk splitting, investigate test output
5. Confirm R010 (no chunk >500KB except maplibre), R011 (all tests pass), R012 (verify:web exits 0).

**Done when:** `pnpm run verify:web` exits 0. All 7 steps pass. No regressions from prior slices.

## Inputs

- `apps/web/vite.config.ts`
- `tests/guards/web-bundle-budget.test.mjs`

## Expected Output

- Update the implementation and proof artifacts needed for this task.

## Verification

pnpm run verify:web

## Observability Impact

None — verification only, no code changes
