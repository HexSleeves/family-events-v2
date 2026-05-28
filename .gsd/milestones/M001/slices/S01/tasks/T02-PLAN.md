---
estimated_steps: 6
estimated_files: 1
skills_used: []
---

# T02: Verify full CI pipeline passes with zero failures

**Why:** The acceptance criterion for S01 is all six CI commands passing, not just web:test. The rename could theoretically affect workspace guards or other checks. This task runs the full `verify:web` pipeline to confirm green baseline.

**Do:**
1. Run `pnpm run verify:web` which executes: docs:test → workspace:test → packages:check → packages:test → web:check → web:test → web:build.
2. Confirm all commands exit 0.
3. Note: `web:build` will emit chunk size warnings (index ~557KB, recharts ~521KB, maplibre ~1055KB) — these are expected and are S04 scope. The build itself must succeed.

**Done when:** `pnpm run verify:web` exits 0. All six CI commands pass. Chunk size warnings in web:build are acknowledged but not blockers.

## Inputs

- `supabase/functions/_shared/stock-images_test.ts`

## Expected Output

- Update the implementation and proof artifacts needed for this task.

## Verification

pnpm run verify:web
