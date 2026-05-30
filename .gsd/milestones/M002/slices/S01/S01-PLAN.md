# S01: Two-Pass Unsplash Search with Test Coverage

**Goal:** Implement two-pass Unsplash search strategy: try bare activity terms first (e.g. "splash park"), fall back to " family" suffix only when first query returns empty. This improves image relevance for activity-specific events like "Yoga in the Park" or "Splash Park".
**Demo:** Manual verification shows "Yoga in the Park" events get yoga/outdoor images, "Splash Park" events get water-play images; all vitest tests pass including new two-pass scenarios; no rate-limit warnings in logs

## Must-Haves

- Manual verification: "Yoga in the Park" events get yoga/outdoor activity images
- Manual verification: "Splash Park" events get water-play images
- All existing vitest tests pass (20+ cases)
- New test cases cover two-pass behavior: bare term hit, suffix fallback, both miss
- No rate-limit warnings in logs after deploy

## Proof Level

- This slice proves: contract + integration

## Integration Closure

Upstream: `supabase/functions/backfill-event-enrichment/index.ts` passes `{ title: row.title }` to `findFallbackImage()` — no changes needed. This slice only modifies the internal search loop within `findFallbackImage()`. Integration is complete when the two-pass logic is in place and covered by tests.

## Verification

- The `matchedTag` field in the return value already provides visibility into which search term succeeded. After this change, it will show whether the bare term or the suffixed fallback matched. No new logging added — existing attribution metadata is sufficient.

## Tasks

- [x] **T01: Implemented two-pass Unsplash search loop: bare activity terms first, " family" suffix fallback only when bare returns empty** `est:45m`
  Why: Current implementation always appends ' family' to every search term, diluting activity-specific queries. A 'Yoga in the Park' search becomes 'yoga in the family' which returns generic family photos instead of yoga/outdoor images.
  - Files: `supabase/functions/_shared/unsplash.ts`
  - Verify: pnpm --filter @family-events/supabase test -- unsplash.test.ts

- [x] **T02: Added comprehensive test coverage for two-pass Unsplash search: 4 new test cases verify bare-first fallback behavior, 5 existing tests updated to expect new query patterns** `est:30m`
  Why: The two-pass logic introduces new code paths that existing tests do not cover: bare term hits immediately, bare term misses but suffix succeeds, both passes miss.
  - Files: `supabase/functions/_shared/unsplash.test.ts`
  - Verify: pnpm --filter @family-events/supabase test -- unsplash.test.ts

## Files Likely Touched

- supabase/functions/_shared/unsplash.ts
- supabase/functions/_shared/unsplash.test.ts
