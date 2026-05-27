# Recommendation: Fix Unsplash Fallback Photo Relevance

**Date:** 2026-05-27  
**Verdict:** Implement — small, contained fix with high impact

---

## Executive Summary

The Unsplash fallback is broken because `findFallbackImage` uses the event's **tag
slug** (e.g. `"sports"`, `"outdoor"`) as the search term instead of the event's
**actual subject**. A "Splash Park" event gets tagged `sports` by the classifier,
then the query `"sports family"` returns whatever Unsplash's top result is for
that generic term — which can be, and was, a Christmas ornament.

The fix is two lines of production code: pass `row.title` into `findFallbackImage`
and try a title-normalized query first, falling back to the existing tag-slug loop
only if the title query returns no results. The event title ("Splash Park at East
Side Recreation Center") produces the query `"splash park family"`, which reliably
returns splash pad / water play photos.

---

## Comparison Matrix

| Approach | Relevance Fix | Code Complexity | Schema Changes | Backfills Existing | Risk |
|----------|--------------|-----------------|-----------------|-------------------|------|
| **Angle 1A: Title-first query (RECOMMEND)** | ✅ Direct | Low (2 LOC) | None | ❌ New events only | Low |
| Angle 1B: per_page=5 random pick | ⚠️ Cosmetic only | Low | None | ✅ (varied results) | Low |
| Angle 2: Add water/aquatic tags | ⚠️ Indirect fix | Medium | Migration needed | ❌ Needs reclassify | Low |
| Angle 3C: LLM-derived photo term | ✅ Best accuracy | High | None | ❌ New events only | Medium (latency) |

---

## Primary Recommendation

### Fix: Title-first Unsplash query with tag-slug fallback

**Change 1 — `supabase/functions/_shared/unsplash.ts`**

Add an optional `title` parameter to `findFallbackImage`. Before walking the tag
slugs, attempt one search using a normalized version of the event title:

```ts
export async function findFallbackImage(
  tags: string[],
  accessKey: string,
  options: { fetchImpl?: typeof fetch; title?: string } = {},
): Promise<UnsplashResult | null> {
  if (!accessKey) return null

  const fetcher = options.fetchImpl ?? fetch
  
  // Build the search queue: title attempt first, then tag slugs
  const queue: Array<{ query: string; matchedTag: string }> = []

  if (options.title?.trim()) {
    const normalized = options.title
      .replace(/\bat\s+\w.*/i, '')  // strip "at Venue Name" suffix
      .replace(/[^\w\s]/g, ' ')     // strip punctuation
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .slice(0, 4)
      .join(' ')
    if (normalized.length > 3) {
      queue.push({ query: `${normalized} family`, matchedTag: normalized })
    }
  }

  for (const rawTag of tags) {
    const tag = rawTag.trim()
    if (tag) queue.push({ query: `${tag} family`, matchedTag: tag })
  }

  for (const { query, matchedTag } of queue) {
    const url = `${SEARCH_ENDPOINT}?query=${encodeURIComponent(query)}&orientation=landscape&per_page=5&content_filter=high`
    // ... (existing fetch + attribution logic, unchanged)
    // pick results[Math.floor(Math.random() * results.length)] instead of results[0]
  }
  return null
}
```

Also change `per_page=1` → `per_page=5` with a random result pick to avoid all
events sharing the same primary tag getting identical photos.

**Change 2 — `supabase/functions/backfill-event-enrichment/index.ts`**

```ts
// Before (line ~265):
unsplashResult = await findFallbackImage(row.tags, unsplashAccessKey);

// After:
unsplashResult = await findFallbackImage(row.tags, unsplashAccessKey, { title: row.title });
```

That's the complete production change. `row.title` is already in the
`EventNeedingEnrichment` interface.

**Change 3 — Update tests**

Update `_shared/unsplash.test.ts` to:
- Test that a title-derived query fires before the tag-slug loop
- Test that title normalization strips "at Venue Name" suffixes
- Test that the tag-slug fallback still fires when the title query returns no results
- Update existing tests that assert `fetchSpy.mock.calls[0][0].includes("query=museum%20family")` 
  since the first call is now title-based

---

## Secondary Recommendation (Follow-up)

### Add water-play / aquatic tags to the vocabulary

After the primary fix lands, add these tags to `classification.ts` TAG_RULES and a
new migration for better long-term classification accuracy:

```ts
{
  slug: "water-play",
  keywords: ["splash park", "splash pad", "water park", "water play", "wading pool", "spray ground"],
},
{
  slug: "nature",  // already exists — ADD keywords:
  // add: "splash", "aquatic", "pond", "lake"
}
```

This is a separate concern from photo selection but improves event discoverability.

---

## Handling Already-Broken Events

Events that already have a bad photo (like the Christmas ornament) are **not
automatically fixed** by this change. Options:

1. **Admin action (recommended):** In the admin event-review panel, clear
   `events.images` for the known-bad event. The next cron tick re-enriches using
   the new title-first logic.
2. **One-time backfill (optional):** Query events where
   `event_image_attributions.matched_tag IN ('sports', 'outdoor', 'free', 'drop-in')`
   (the coarse tags) and clear their images. This triggers re-enrichment on the
   next cron tick.

The admin route is sufficient given the low volume of affected events.

---

## Risk Factors

- **Title normalization edge cases:** Very long or generic titles ("Community Day")
  may still produce a mediocre title query — but the tag-slug fallback still runs,
  so it's no worse than today
- **Changing the behavior of existing tests:** `findFallbackImage` tests assert on
  the first fetch call URL — those need updating, but it's a test-change not a
  behavior regression
- **What would change this recommendation:** If the title normalization logic
  produces _worse_ results than the current tag-slug approach (unlikely — a specific
  title beats a generic tag almost always), we'd revert to Angle 2 (expanded tags)
  as the primary fix instead

---

## Next Steps (if recommendation accepted)

1. Implement `findFallbackImage` changes in `_shared/unsplash.ts`
2. Update call site in `backfill-event-enrichment/index.ts` (+1 line)
3. Update `_shared/unsplash.test.ts` for new behavior
4. Deploy edge function
5. Admin: clear `images` on known-bad events via admin panel
6. Follow-up: add water-play tag + keywords (separate PR, separate migration)

---

## Wrap-Up Options

This spike's findings are **reusable guidance** — the pattern of "prefer the most
specific text signal (title) over the most available signal (tag slug) when
querying stock photo APIs" will apply to any future stock photo/media integrations.

Suggest running `spike-wrap-up` to package this as a project-local skill.
Alternatively, append a decision one-liner to `.gsd/DECISIONS.md`:
> D-XXX: Unsplash fallback uses event title as primary search term before tag slug — title is more specific and produces more relevant photos for niche activity events (splash parks, pottery classes, etc.).
