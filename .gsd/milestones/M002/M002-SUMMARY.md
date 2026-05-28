---
milestone: M002
status: complete
completed_at: 2026-05-28T03:50:48.000Z
---

# M002: Image Generation Fallback Flow - Two-Pass Search

**Implemented two-pass stock image search with noise word filtering; batch-enriched 453 events with relevant photos.**

## What Happened

Delivered a two-pass search strategy for stock image fallback in `findFallbackImage()`. The function now tries each search term bare first, falling back to the " family" suffixed version only when bare returns zero results. Added a `NOISE_WORDS` filter to `deriveTitleSearchTerm()` that strips filler words (free, annual, weekly, the, a, for, etc.) before the 4-word cap, so search slots are occupied by content-bearing terms.

Deployed the updated `backfill-event-enrichment` edge function to production and manually batch-enriched 453 upcoming events with relevant Pexels stock photos. All 142+ tests pass including 29 unsplash-specific tests with dedicated two-pass coverage.

## Key Decisions

- Two-pass inner loop with attempts array per search term
- Noise word filtering applied before 4-word cap
- Pexels as primary provider (200/hr vs Unsplash 50/hr)
- Batch manual enrichment for 453 events to immediately fix production

## Key Files

- `supabase/functions/_shared/stock-images.ts` — noise word filtering, deriveTitleSearchTerm
- `supabase/functions/_shared/unsplash.ts` — two-pass search loop in findFallbackImage  
- `supabase/functions/_shared/stock-images.test.ts` — 15 Deno tests for search term derivation
- `supabase/functions/_shared/unsplash.test.ts` — 29 tests for two-pass behavior

## Follow-ups

- Monitor enrichment cron for bare-vs-suffix success rates
- Add structured log counter for search hit/miss patterns
