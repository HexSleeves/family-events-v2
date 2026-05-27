# Image Generation / Fallback Flow Refactor — Inventory

**Problem:** Events are receiving irrelevant Unsplash images. "Yoga in the Park" gets astronaut/space images; "Mom Walks" gets NYC skyline. The current fallback strategy is too generic.

**Root cause analysis:**

1. `findFallbackImage()` in `supabase/functions/_shared/unsplash.ts` searches with `"{term} family"` appended to every query
2. Title-derived search terms are tried first, but when they return empty results, the system falls back to tag slugs
3. Tag slugs are ordered by confidence DESC from the database (correct ordering)
4. The `" family"` suffix broadens searches but can dilute specificity — "yoga family" may return family photos in any setting, not yoga-specific images
5. Per-page is 5 with random selection, which helps diversity but doesn't guarantee relevance

## Files Requiring Changes

### Core Implementation (Wave 1)

- **`supabase/functions/_shared/unsplash.ts`** — `findFallbackImage()` function
  - Current: Appends " family" to every search term (title-derived and tag slugs)
  - Change: Make " family" suffix conditional or context-aware; consider trying without suffix first
  - Lines affected: ~220-280 (search queue building + fetch loop)

### Tests (Wave 2)

- **`supabase/functions/_shared/unsplash.test.ts`** — Unit tests for `findFallbackImage()`
  - 10+ test cases covering title-derived terms, tag fallback, random selection
  - Need to add tests for:
    - Title-derived search without " family" suffix
    - Tag slug search with/without suffix based on tag type
    - Relevance scoring if we implement it
  - Lines affected: ~150-300

### Integration Points (Wave 3)

- **`supabase/functions/backfill-event-enrichment/index.ts`**
  - Calls `findFallbackImage(row.tags, unsplashAccessKey, { title: row.title })`
  - Tags are pre-sorted by confidence DESC from SQL query
  - No changes needed unless we want to filter tags or adjust options
  - Lines affected: ~180-190 (enrichment loop)

### Documentation (Wave 4)

- **`supabase/functions/_shared/unsplash.ts`** — Inline comments explaining strategy
  - Update comment block lines 1-50 to reflect new search strategy
  - Document why " family" is conditional and what triggers fallback behavior

## Dependency Relationships

```
unsplash.ts (core logic)
    ↓ imported by
backfill-event-enrichment/index.ts (caller)
    ↓ uses
SQL queries (tag ordering in migrations)
    ↓ tested by
unsplash.test.ts (unit tests)
```

Changes must happen in this order:

1. Update `findFallbackImage()` logic
2. Update unit tests to cover new behavior
3. Verify integration in backfill function (likely no changes needed)
4. Update inline documentation

## Scope Estimate

- **Files modified:** 2 (unsplash.ts, unsplash.test.ts)
- **Files reviewed:** 1 (backfill-event-enrichment/index.ts)
- **Lines affected:** ~100-150 lines across 2 files
- **Tests to add/modify:** ~5-10 test cases
- **Risk level:** Medium — this affects all events without scraped images (fallback coverage is ~30-40% of events based on comment)

## Proposed Solutions (for planning phase)

**Option A: Remove " family" suffix entirely**

- Pros: More specific results; "yoga" → yoga photos, not family photos
- Cons: May reduce result count; some events are family-focused and benefit from the suffix

**Option B: Conditional suffix based on tag type**

- Pros: Activity tags (yoga, storytime) don't get suffix; family-oriented tags (family-friendly) do
- Cons: Requires tag taxonomy knowledge; more complex logic

**Option C: Try without suffix first, fallback with suffix**

- Pros: Best of both worlds; specificity first, breadth second
- Cons: Doubles API calls on miss; may hit rate limits faster

**Option D: Use multiple search terms per tag (OR query)**

- Pros: Combines specificity and breadth in one query
- Cons: Unsplash API doesn't support OR queries; would require custom result merging

**Recommendation: Option C** — Try title-derived and primary tag without suffix first, fall back to " family" suffix if no results. This balances relevance and coverage while staying within rate limits (we're at ~2400/day, well under 5000/hr limit).

## Tags from Screenshot

Based on the visible events:

- "Yoga in the Park" likely has tags: outdoor, yoga, wellness
- "Mom Walks" likely has tags: outdoor, walking, family-friendly

The issue: generic tags like "outdoor" + " family" → broad landscape shots (NYC skyline, space photos) instead of activity-specific imagery.
