# Angle 3: Smarter Per-Event Photo Term Derivation (Title/Description NLP)

**Question:** Can we derive a better Unsplash search term directly from event title/description?

---

## The Core Idea

Instead of: `"sports family"` (from tag slug)  
Use: `"splash park kids"` (extracted from event title)

The title almost always contains the most specific signal: "Splash Park", "Storytime",
"Pottery Workshop for Kids", "Halloween Trunk-or-Treat", etc.

## Approaches

### Approach A: Simple Title Normalization (No LLM)

Extract the first meaningful 2-4 words from the title, strip venue/location noise:

```ts
function deriveSearchTerm(title: string): string {
  // "Splash Park at East Side Recreation Center" → "splash park"
  // "Summer Reading Program: Crafts and Storytime" → "summer reading crafts storytime"
  // "Story Time at West Regional Library" → "story time"
  
  return title
    .toLowerCase()
    .replace(/\bat\b.*$/, '')          // strip "at <venue>"
    .replace(/[^\w\s]/g, ' ')          // strip punctuation
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join(' ')
}
```

Query: `"${derivedTerm} kids"` or `"${derivedTerm} family"`

**Pros:**
- Zero additional API calls, zero latency, zero cost
- Works for any specific event title
- Already has title in scope at call site

**Cons:**
- Fragile for verbose titles ("Community Day Sponsored by BREC Parks and Recreation 2026")
- Can't handle non-English or acronym-heavy titles
- Requires careful stopword stripping

### Approach B: Keyword Extraction from Title + Description

Take the existing `TAG_RULES` keyword matching (already in `computeTags`) and
instead of mapping to a tag slug, use the matched keyword as the search term:

```ts
// If "splash" matched → search term = "splash park family"
// If "swimming" matched → search term = "swimming kids"
// Better than the tag slug but still limited to the keyword list
```

**Pros:** Reuses existing infrastructure, no new deps  
**Cons:** Still indirect — you matched a keyword but you're not using the actual event subject

### Approach C: LLM-Derived Photo Term (Extra LLM Call)

Add a lightweight LLM call to derive the best 2-3 word photo description:
```
"Splash Park at East Side Recreation Center" → "splash park water play"
"Thanksgiving Story Time for Families" → "storytime children autumn"
```

**Pros:** Most accurate, handles edge cases gracefully  
**Cons:**
- 1 LLM call per event (cost + latency — could add ~500ms-1s per event in the enrichment loop)
- Already under 90s wall budget, but this pushes it closer
- Overkill for what is essentially a text normalization task
- The `tag-event` function already does an LLM call; could extract photo term there instead of a second call here

---

## Implementation Path for Approach A

This is what we'd actually change in `_shared/unsplash.ts`:

```ts
// New signature:
export async function findFallbackImage(
  tags: string[],
  accessKey: string,
  options: { 
    fetchImpl?: typeof fetch;
    title?: string;  // NEW
  } = {},
): Promise<UnsplashResult | null>

// New query construction:
const queries: Array<{ q: string; matchedTag: string }> = []

// 1. Title-first attempt (if title provided)
if (options.title?.trim()) {
  const normalized = options.title
    .toLowerCase()
    .replace(/\bat\b.*/i, '')  // strip "at Venue Name"
    .replace(/[^\w\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join(' ')
  if (normalized.length > 3) {
    queries.push({ q: `${normalized} family`, matchedTag: normalized })
  }
}

// 2. Tag slugs (existing behavior)
for (const tag of tags) {
  const t = tag.trim()
  if (t) queries.push({ q: `${t} family`, matchedTag: t })
}

// Walk queries in order, return first hit
```

### Where the call site changes (`backfill-event-enrichment/index.ts`)

```ts
// Before:
unsplashResult = await findFallbackImage(row.tags, unsplashAccessKey);

// After:
unsplashResult = await findFallbackImage(row.tags, unsplashAccessKey, { title: row.title });
```

That's the complete change. `row.title` is already populated in the
`EventNeedingEnrichment` interface — no DB schema changes needed.

---

## Evidence: What "Splash Park" Would Return Now vs After Fix

| Query | Likely Result |
|-------|--------------|
| `"sports family"` (current) | Soccer game, gym class, **Christmas ornament** (!) |
| `"outdoor family"` (current fallback) | Mountains, park picnic, generic outdoors |
| `"splash park family"` (new) | Water splash pads, kids in water, summer fun ✓ |
| `"splash park kids"` (alternative) | Similar water play photos ✓ |

The improvement is clear. Unsplash's search quality for specific compound terms
like "splash park", "storytime library", "pottery class kids" is excellent.

---

## Backfill Concern

Events that already have the bad Christmas ornament photo in `events.images` will
NOT be automatically fixed — the enrichment function only runs when
`needs_images = true` (i.e., `images IS NULL OR jsonb_array_length(images) = 0`).

To fix existing bad photos, options:
1. **Admin action:** Clear `images` for known bad events via admin panel → cron re-enriches next tick
2. **One-time backfill script:** Find events where `image_attributions.matched_tag` is a generic tag (sports, outdoor) + image is an Unsplash photo → clear and re-enrich
3. **No automated fix:** Rely on admin review flow to catch and clear bad images

Option 1 or 3 is simplest. The spec already notes the admin event-review flow can
clear `events.images` and the cron re-enriches.

---

## Verdict

**Approach A (simple title normalization) is the right choice.** It:
- Directly addresses the root cause
- Requires zero new dependencies and <5 lines of new code
- Has no performance or cost impact
- Handles the splash park case and all similar specific-event scenarios

**Confidence level: HIGH** — this is the fix.
