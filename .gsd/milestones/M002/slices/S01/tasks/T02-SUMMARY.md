---
id: T02
parent: S01
milestone: M002
key_files:
  - supabase/functions/_shared/unsplash.test.ts
key_decisions:
  - Updated existing test mocks to handle two-pass query logic: bare query first, then suffixed fallback only when bare returns empty
  - All matchedTag assertions now expect the actual query string that succeeded (bare or suffixed) rather than just the base term
  - Test count increased from 26 to 30 covering all two-pass code paths
duration: 
verification_result: passed
completed_at: 2026-05-27T15:40:08.976Z
blocker_discovered: false
---

# T02: Added comprehensive test coverage for two-pass Unsplash search: 4 new test cases verify bare-first fallback behavior, 5 existing tests updated to expect new query patterns

**Added comprehensive test coverage for two-pass Unsplash search: 4 new test cases verify bare-first fallback behavior, 5 existing tests updated to expect new query patterns**

## What Happened

Updated the test suite in `supabase/functions/_shared/unsplash.test.ts` to align with the two-pass search implementation from T01. The changes fall into two categories:

**Fixed 5 existing tests** that expected the old always-suffixed behavior:
1. "uses the title-derived term before tag slugs" - now expects bare "splash park" query first, not "splash park family"
2. "falls through to tag slugs when title query returns no results" - updated mock to handle 4 fetches (title bare, title suffix, tag bare, tag suffix) and expects matchedTag "sports family" when suffix succeeds
3. "hits the search endpoint and returns image plus attribution metadata" - expects bare "museum" query first
4. "falls through to the next tag when the first one yields no results" - updated mock for two-pass behavior, expects matchedTag "park family" when suffix succeeds
5. "ignores blank tag entries" - expects bare "library" query first

**Added 4 new test cases** covering the two-pass scenarios:
1. "uses bare term when it returns results (no suffix needed)" - verifies bare "yoga" query succeeds immediately, matchedTag is "yoga", only 1 fetch
2. "falls back to suffix when bare term returns empty" - mock returns empty for bare "cooking", succeeds on "cooking family", matchedTag reflects "cooking family", 2 fetches
3. "returns null when both bare and suffixed queries return empty" - both passes fail, returns null, 2 fetches
4. "matchedTag reflects the term that actually succeeded (bare vs suffixed)" - two scenarios: bare "sports" succeeds → matchedTag "sports", and suffixed "picnic family" succeeds → matchedTag "picnic family"

All mocks use proper query string detection with `!target.includes("family")` to distinguish bare from suffixed queries. Test assertions verify both the correct number of fetches and the correct matchedTag values that reflect which query actually succeeded.

## Verification

Ran test suite via `pnpm --filter @family-events/supabase-functions test -- unsplash.test.ts`. All 143 tests pass (up from 139 before adding 4 new tests). The unsplash.test.ts file now has 30 test cases covering all aspects of the two-pass search behavior: immediate bare hits, suffix fallback, both-pass misses, and matchedTag observability.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `pnpm --filter @family-events/supabase-functions test -- unsplash.test.ts` | 0 | ✅ pass | 578ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `supabase/functions/_shared/unsplash.test.ts`
