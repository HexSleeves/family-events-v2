# Image Generation / Fallback Flow Refactor — Plan

## Strategy

Implement **Option C** from the inventory: Try searches without " family" suffix first, fallback to suffix if no results. This balances specificity (better relevance) with coverage (ensures we still get images when narrow searches miss).

## Key Changes

1. **Split search strategy into two passes per term:**
   - Pass 1: Query `"{term}"` (no suffix) → more specific results
   - Pass 2: Query `"{term} family"` (with suffix) → broader fallback
2. **Preserve existing behavior:** Title-derived terms before tag slugs; random selection from results
3. **Optimize API usage:** Only make the second call if the first returns zero results

## Wave Structure

### Wave 1: Core Logic — `findFallbackImage()` Enhancement

**File:** `supabase/functions/_shared/unsplash.ts`

**Changes:**
1. Modify the search loop to try each term twice: first without suffix, then with suffix if needed
2. Add a helper function `trySearch(term: string, suffix: string, fetcher: typeof fetch, accessKey: string)` to encapsulate the fetch logic
3. Update the main loop:
   ```typescript
   for (const { searchTerm } of queue) {
     // Try without suffix first
     const result = await trySearch(searchTerm, "", fetcher, accessKey)
     if (result) return { ...result, matchedTag: searchTerm }
     
     // Fallback: try with " family" suffix
     const resultWithSuffix = await trySearch(searchTerm, " family", fetcher, accessKey)
     if (resultWithSuffix) return { ...resultWithSuffix, matchedTag: `${searchTerm} family` }
   }
   ```
4. Keep random selection from per_page=5 results (existing behavior)

**Affected lines:** ~220-280

**Verification:** Run existing unit tests — should pass with no changes (tests mock fetch, so they're decoupled from search strategy)

**Commit:** `refactor(unsplash): try searches without 'family' suffix first, fallback if empty`

---

### Wave 2: Unit Tests — Coverage for New Behavior

**File:** `supabase/functions/_shared/unsplash.test.ts`

**New tests:**
1. `it("tries search without suffix before adding 'family' suffix")`
   - Mock fetch to return empty on first call, results on second
   - Verify two fetch calls happen with correct query params
2. `it("returns result from no-suffix search when available")`
   - Mock fetch to return results on first call
   - Verify only one fetch call (no fallback needed)
3. `it("falls back to suffix search for each term in queue")`
   - Mock multiple terms, first term fails both passes, second term succeeds on suffix pass
   - Verify correct fallback behavior
4. `it("preserves matched tag in result (with or without suffix)")`
   - Verify result.matchedTag reflects what actually worked

**Affected lines:** ~300-400 (new tests)

**Verification:** `pnpm test supabase/functions/_shared/unsplash.test.ts` exits 0

**Commit:** `test(unsplash): add coverage for two-pass search strategy`

---

### Wave 3: Integration Verification — Backfill Function

**File:** `supabase/functions/backfill-event-enrichment/index.ts`

**Changes:** None expected (caller already passes title + tags correctly)

**Verification steps:**
1. Review the call site: `findFallbackImage(row.tags, unsplashAccessKey, { title: row.title })`
2. Confirm tags are ordered by confidence DESC (they are, per SQL query)
3. Run a local/staging backfill dry-run with 5-10 events and inspect:
   - Do "Yoga in the Park" events get yoga-related images?
   - Do "Mom Walks" events get walking/outdoor activity images?
   - Does the matchedTag field in logs show suffix usage?

**Manual test commands:**
```bash
# Local backfill test (requires supabase local running)
curl -X POST 'http://localhost:54321/functions/v1/backfill-event-enrichment' \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"batch_size": 5}'

# Check logs for matched_tag field
```

**Expected outcome:** More activity-specific images; fewer irrelevant landscape/cityscape photos

**Commit:** (none — verification only)

---

### Wave 4: Documentation Update

**File:** `supabase/functions/_shared/unsplash.ts`

**Changes:**
1. Update the file-level comment block (lines 1-50) to document the two-pass strategy:
   ```
   // Query strategy — most-specific first, with fallback:
   //   1. Title-derived term (no suffix): "splash park" → water-specific images
   //   2. Title-derived term + " family": "splash park family" → broader match
   //   3. Tag slug (no suffix): "yoga" → activity-specific images  
   //   4. Tag slug + " family": "yoga family" → family-oriented fallback
   ```
2. Add inline comment above the two-pass loop explaining the fallback logic
3. Update the "Rate limit" comment to note we now make up to 2 calls per term (still well under 5000/hr)

**Affected lines:** ~1-50, ~240-250

**Verification:** Read the updated comments — ensure they match the implemented behavior

**Commit:** `docs(unsplash): update search strategy documentation for two-pass approach`

---

## Risk Mitigation

1. **Rate limits:** Current usage ~2400/day; two-pass could double to ~4800/day (still under 5000/hr limit)
2. **Performance:** Each event with no images adds ~5-10s (2× search calls @ ~2.5-5s each). Acceptable for enrichment cron.
3. **Regression:** Existing tests must pass after Wave 1; new tests in Wave 2 prove correct behavior
4. **Rollback:** If images worsen, revert the Wave 1 commit and redeploy

## Success Criteria

- [ ] `findFallbackImage()` tries searches without suffix first
- [ ] Suffix fallback triggers only when no-suffix search returns empty
- [ ] All unit tests pass (existing + new)
- [ ] Manual verification shows more relevant images for sample events
- [ ] No rate limit warnings in production logs after deploy

## Estimated Effort

- Wave 1: 30 minutes (logic refactor)
- Wave 2: 45 minutes (4 new test cases)
- Wave 3: 20 minutes (manual verification)
- Wave 4: 15 minutes (doc update)
- **Total:** ~2 hours
