---
id: T01
parent: S01
milestone: M002
key_files:
  - supabase/functions/_shared/unsplash.ts
  - supabase/functions/vitest.config.ts
  - supabase/functions/package.json
key_decisions:
  - Two-pass loop structure: inner attempts array ['term', 'term family'] for each outer queue entry
  - matchedTag returns the actual query string that succeeded (bare or suffixed) for observability
  - Created vitest.config.ts with include pattern '_shared/**/*.test.ts' to enable test execution
duration: 
verification_result: mixed
completed_at: 2026-05-27T15:30:52.802Z
blocker_discovered: false
---

# T01: Implemented two-pass Unsplash search loop: bare activity terms first, " family" suffix fallback only when bare returns empty

**Implemented two-pass Unsplash search loop: bare activity terms first, " family" suffix fallback only when bare returns empty**

## What Happened

Modified `findFallbackImage()` in `supabase/functions/_shared/unsplash.ts` to implement a two-pass search strategy for each candidate term in the queue. For each search term (title-derived or tag slug), the function now:

1. **First pass**: Tries the bare term (e.g., "splash park") with no suffix
2. **Second pass**: Falls back to "{term} family" only when the bare query returns zero results

This change preserves the existing search queue order (title-derived term first, then tag slugs) and random selection logic, while making activity-specific searches more precise. A "Yoga in the Park" event now queries "yoga in the park" first, getting yoga/outdoor photos instead of generic family images.

The `matchedTag` field now correctly reflects which query succeeded—bare or suffixed—providing observability into which pass worked. This is the intended behavior per the task spec: "The matchedTag field will now show whether a bare term ('splash park') or suffixed term ('splash park family') matched."

Created `supabase/functions/vitest.config.ts` and added a test script to `supabase/functions/package.json` to enable running the existing test suite via `pnpm --filter @family-events/supabase-functions test`.

**Expected test failures:** Five existing tests now fail because they expect the old behavior (always appending " family" and returning only the base search term in `matchedTag`). These tests verify:
1. URLs contain "query={term}%20family" 
2. `matchedTag` equals the base term without " family"

The failures are correct—the implementation now tries bare terms first, and `matchedTag` reflects the actual query that succeeded. T02 will update these tests and add new test coverage for the two-pass scenarios (bare hit, suffix fallback, both miss).

## Verification

Ran test suite via `pnpm --filter @family-events/supabase-functions test`. Implementation correctly tries bare terms first, then falls back to suffixed queries when bare returns empty. The `matchedTag` field now shows the actual successful query.

Five tests fail as expected—they assert the old behavior (always suffixed queries). These will be fixed in T02:
- "uses the title-derived term before tag slugs" - expects suffixed URL, gets bare
- "falls through to tag slugs when title query returns no results" - expects base matchedTag, gets suffixed
- "hits the search endpoint and returns image plus attribution metadata" - expects suffixed URL, gets bare
- "falls through to the next tag when the first one yields no results" - expects base matchedTag, gets suffixed
- "ignores blank tag entries" - expects suffixed URL, gets bare

Test failures confirm the implementation is working: when mock returns results on first query, bare term succeeds (no fallback needed); when mock returns empty first, suffix fallback succeeds.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `pnpm --filter @family-events/supabase-functions test` | 1 | ⚠️  Expected failures (5/139 tests) — implementation correct, tests need T02 updates | 7909ms |

## Deviations

Created `vitest.config.ts` and added test script to `package.json` to enable running tests (not mentioned in task plan but necessary for verification). The task plan verification command `pnpm --filter @family-events/supabase test -- unsplash.test.ts` did not work because the package name is `@family-events/supabase-functions` (not `supabase`) and no test script existed.

## Known Issues

Five existing tests fail because they expect the old behavior (always-suffixed queries). This is expected and documented in the task plan as work for T02. The implementation is correct per the spec; tests will be updated in T02 to expect bare-first behavior and properly mock both passes.

## Files Created/Modified

- `supabase/functions/_shared/unsplash.ts`
- `supabase/functions/vitest.config.ts`
- `supabase/functions/package.json`
