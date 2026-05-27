# M002: Image Generation Fallback Flow - Two-Pass Search

**Vision:** Improve relevance of Unsplash fallback images for activity-specific events by trying narrow searches first (without " family" suffix), then falling back to broader searches only when the narrow query returns empty. Current implementation dilutes activity-specific queries by always appending " family" to every search term.

## Success Criteria

- "Yoga in the Park" events get yoga/outdoor activity images (not family portraits)
- "Mom Walks" events get walking/trail images (not generic family photos)
- "Splash Park" events get water-play images (not generic park landscapes)
- Events with obscure terms still get images via " family" suffix fallback
- No rate-limit warnings in production logs after deploy
- All existing unit tests continue to pass

## Slices

- [ ] **S01: Two-Pass Unsplash Search with Test Coverage** `risk:medium` `depends:[]`
  > After this: Manual verification shows "Yoga in the Park" events get yoga/outdoor images, "Splash Park" events get water-play images; all vitest tests pass including new two-pass scenarios; no rate-limit warnings in logs

## Boundary Map

```
┌─────────────────────────────────────────────────────────────┐
│ supabase/functions/backfill-event-enrichment/index.ts      │
│ (caller - no changes needed)                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │ passes { title: row.title }
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ supabase/functions/_shared/unsplash.ts                      │
│                                                               │
│  findFallbackImage(options)  ← CHANGE TARGET                │
│    ├─ deriveTitleSearchTerm() (existing, unchanged)         │
│    ├─ searchQueue: [titleTerm, ...tagSlugs]                 │
│    └─ For each term:                                         │
│         1. Try bare search (NEW)                             │
│         2. If empty → try with " family" suffix (NEW)       │
│         3. If hit → pick random + extract attribution       │
│                                                               │
└──────────────────────┬──────────────────────────────────────┘
                       │ returns { url, matchedTag, attribution }
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Unsplash API (external)                                     │
│ Rate limit: 5000 req/hr                                      │
│ Current usage: ~2400 req/day (well under limit)             │
└─────────────────────────────────────────────────────────────┘

Test Coverage:
supabase/functions/_shared/unsplash.test.ts
  ├─ Existing: 20+ cases (search ordering, random selection, 
  │            attribution, errors, empty results)
  └─ New: Two-pass scenarios (first hit, suffix fallback, both miss)
```
