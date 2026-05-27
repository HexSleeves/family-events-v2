---
id: S01
parent: M002
milestone: M002
provides:
  - Two-pass Unsplash search (bare term first, suffix fallback only when empty)
  - Comprehensive test coverage for two-pass scenarios (29 unsplash tests, 142 total)
requires:
  []
affects:
  []
key_files:
  - supabase/functions/_shared/unsplash.ts
  - supabase/functions/_shared/unsplash.test.ts
  - supabase/functions/vitest.config.ts
  - supabase/functions/package.json
key_decisions:
  - Two-pass loop structure: inner attempts array ['term', 'term family'] for each outer queue entry
  - matchedTag returns actual query string (bare or suffixed) for observability
  - Test coverage includes dedicated two-pass suite with 3 scenarios
patterns_established:
  - Two-pass search pattern for external API queries where specificity matters
observability_surfaces:
  - matchedTag field shows which query succeeded (bare vs suffixed)
drill_down_paths:
  - .gsd/milestones/M002/slices/S01/tasks/T01-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-05-27T15:48:41.740Z
blocker_discovered: false
---

# S01: Two-Pass Unsplash Search with Test Coverage

**Implemented two-pass Unsplash search — tries bare activity terms first, falls back to " family" suffix only when bare returns empty; all 142 tests pass including 29 unsplash-specific tests with dedicated two-pass coverage**

## What Happened

Modified `findFallbackImage()` in `supabase/functions/_shared/unsplash.ts` to implement a two-pass search strategy. For each candidate term in the queue (title-derived or tag slug), the function now: (1) First pass: tries the bare term with no suffix; (2) Second pass: falls back to "{term} family" only when bare returns zero results. This preserves the existing search queue order and random selection logic while making activity-specific searches more precise. The `matchedTag` field now reflects which query succeeded for observability. Created vitest config, added test script, and updated all existing tests to expect two-pass behavior plus 3 dedicated two-pass scenarios.

## Verification

Ran `pnpm test` in supabase/functions/: all 142 tests pass across 5 test files, including 29 unsplash-specific tests. Test coverage validates bare-first success, suffix fallback, and multi-term exhaustion. matchedTag returns actual successful query string.

## Requirements Advanced

None.

## Requirements Validated

None.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Operational Readiness

None.

## Deviations

Created vitest.config.ts and added test script (not in task plan but required for verification). Task plan used wrong package name and assumed test script existed.

## Known Limitations

Manual verification of image relevance improvement requires production deploy. No monitoring dashboard yet for bare-first vs suffix fallback success rate. Performance impact of 2× API calls per miss is acceptable (16.7% of rate limit).

## Follow-ups

Deploy to Railway cron, canary check image relevance for 5-10 activity events, optionally add structured log counter for bare vs suffix success rate if fallback patterns unexpected.

## Files Created/Modified

- `supabase/functions/_shared/unsplash.ts` — Implemented two-pass loop: attempts array [term, 'term family'], matchedTag returns actual query
- `supabase/functions/_shared/unsplash.test.ts` — Updated all tests for two-pass behavior + added dedicated two-pass suite (3 scenarios)
- `supabase/functions/vitest.config.ts` — Created to enable test execution with include pattern '_shared/**/*.test.ts'
- `supabase/functions/package.json` — Added test script 'vitest run'
