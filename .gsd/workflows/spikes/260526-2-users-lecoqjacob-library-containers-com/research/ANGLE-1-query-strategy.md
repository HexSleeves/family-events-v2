# Angle 1: Improve the Unsplash Query Strategy

**Question:** Can we get better photos by changing _what_ we pass as the Unsplash search term?

---

## Current Implementation

```ts
// _shared/unsplash.ts:194-196
const query = `${tag} family`
const url = `${SEARCH_ENDPOINT}?query=${encodeURIComponent(query)}&orientation=landscape&per_page=1&content_filter=high`
```

`tags` comes from `row.tags` (the event's tag slugs, ordered by confidence DESC). The
first non-empty slug wins.

**The Splash Park example path:**
1. Event title: "Splash Park at East Side Recreation Center"
2. Classification: "swim" keyword → `sports` tag (confidence ~0.6), "park" keyword → `outdoor` (confidence ~0.5)
3. Query sent to Unsplash: `"sports family"` (or `"outdoor family"` if sports misses)
4. Unsplash returns its current #1 result for that query — could be anything: soccer, Christmas, winter festival, etc.
5. That URL is persisted **permanently** in `events.images[]`

Two compounding problems:
- `per_page=1` means the API always returns the same single deterministic result
- Tag slugs like `sports` and `outdoor` are intentionally broad — they map to 10+ sub-activities

---

## What the Unsplash Search API Supports

Key parameters relevant here:
- `query` — free-text search term (supports multi-word phrases)
- `orientation` — `landscape` ✓ already used
- `per_page` — 1–30 results per request (currently `1`)
- `page` — pagination (could combine with `per_page=5` + random pick to vary results)
- `order_by` — `relevant` (default) or `latest`
- `content_filter` — `high` ✓ already used

**What we can improve within the existing API:**
- Use a more specific query term (title keywords > tag slug)
- Use `per_page=5` and pick randomly among results to avoid always getting the same photo
- No additional cost — still one HTTP request per event

---

## Option A: Use Event Title as Primary Query

Replace `${tag} family` with a normalized event title:

```ts
// Pseudocode change in findFallbackImage signature:
findFallbackImage(tags: string[], accessKey: string, title?: string)
```

Query priority:
1. Title-based: `"${normalizedTitle} kids"` (first 30 chars, lowercased, stripped punctuation)
2. Tag fallback: `"${tag} family"` (current behavior, unchanged)

For "Splash Park at East Side Recreation Center":
- Title query: `"splash park kids"` → Unsplash returns splash pad / water play photos ✓
- Would only fall through to tag-slug if title query returns 0 results

**Pros:**
- Directly uses the most specific signal available (what the event IS)
- Requires zero schema changes — title is already in `EventNeedingEnrichment.title`
- No new LLM calls, no new dependencies
- Small code change: 1 new parameter + 1 new search attempt in the for-loop

**Cons:**
- Long or generic titles ("Community Day") would still produce mediocre results
- Title may contain venue name which doesn't help: "Story Time at West Regional Library Branch" → `"story time at west regional"` → truncation needed

**Confidence:** HIGH — this directly fixes the splash park case with minimal code change

---

## Option B: Randomize Among Top N Results

Change `per_page=1` to `per_page=5`, pick randomly:

```ts
const hit = body.results?.[Math.floor(Math.random() * (body.results?.length ?? 1))]
```

**Pros:** Prevents the "every event with tag X gets the same photo forever" pattern  
**Cons:** Doesn't fix the relevance problem — 5 `"sports family"` photos are still sports photos  
**Verdict:** Worth doing as a secondary improvement, but doesn't fix the root cause

---

## Evidence from Codebase

The `enrichOne` function (backfill-event-enrichment/index.ts:228-234) already has `row.title`
and `row.description` in scope when `findFallbackImage` is called:

```ts
// existing shape — title is RIGHT THERE:
interface EventNeedingEnrichment {
  event_id: string;
  title: string;           // ← available
  description: string | null;  // ← available
  tags: string[];          // ← currently used
}

// call site:
unsplashResult = await findFallbackImage(row.tags, unsplashAccessKey);
//                                       ^^^^^^^^^^ only tags, title ignored
```

The fix is one line at the call site and one parameter addition in `findFallbackImage`.

---

## Verdict

**High impact, low effort.** Option A (title-first query) is the primary fix.
Option B (per_page=5 random pick) is a complementary small improvement.
Combined: prepend a title-based search attempt before the tag-slug loop.

**Confidence level: HIGH** — root cause is confirmed, fix is obvious and contained.
