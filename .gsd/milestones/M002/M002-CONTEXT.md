# M002: Image Generation Fallback Flow — Two-Pass Search

## Vision

Improve relevance of Unsplash fallback images for activity-specific events by trying narrow searches first (without " family" suffix), then falling back to broader searches only when the narrow query returns empty.

## Problem

Current implementation always appends " family" to every search term:
- "yoga family" returns generic family portrait photos instead of yoga class images
- "splash park family" dilutes water-play specificity with family picnic scenes
- "mom walks family" adds noise that pulls results away from walking/outdoor activity

Impact: Events with clear activity signals get less relevant images than they should.

## Goals

1. **More relevant images** — activity-specific events get photos that match the activity, not generic family scenes
2. **Preserve coverage** — still get images when narrow searches miss (fallback to " family" suffix)
3. **No behavior regression** — keep existing search ordering (title-first, tag confidence DESC), random selection, rate-limit compliance

## Scope

**In scope:**
- Refactor `findFallbackImage()` to try two passes per term: no-suffix first, suffix fallback second
- Add unit tests for the two-pass behavior
- Update documentation to reflect the new strategy
- Manual verification with sample events

**Out of scope:**
- Changing the search term derivation logic (title normalization, tag ordering)
- Adding new Unsplash API features (collections, user filters)
- Modifying the backfill cron schedule or batch size

## Success Criteria

1. "Yoga in the Park" events get yoga/outdoor activity images (not family portraits)
2. "Mom Walks" events get walking/trail images (not generic family photos)
3. "Splash Park" events get water-play images (not generic park landscapes)
4. Events with obscure terms still get images via the " family" suffix fallback
5. No rate-limit warnings in production logs after deploy
6. All existing unit tests continue to pass

## Constraints

- Must stay under Unsplash's 5000 req/hr rate limit
- Cannot break existing attribution tracking flow
- Must preserve random selection to avoid photo duplication across events
- Changes must be testable without live Unsplash API access

## Non-Goals

- Optimizing for speed (each event already takes 5-10s for enrichment; 2× search calls is acceptable)
- Supporting multiple image candidates per event (we still pick one)
- Caching Unsplash results (events are enriched once, then images are stable)

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| When to apply suffix | Only when no-suffix search returns empty | Balances specificity with coverage |
| Search order | Title-first, then tags in confidence order | Existing behavior proven effective |
| API calls per term | Up to 2 (no-suffix, then suffix if needed) | Doubles API usage but stays well under rate limit |
| Fallback behavior | Try every term with both passes before giving up | Maximizes chance of finding a relevant image |

## References

- Existing implementation: `supabase/functions/_shared/unsplash.ts` lines 220-280
- Unit tests: `supabase/functions/_shared/unsplash.test.ts`
- Backfill caller: `supabase/functions/backfill-event-enrichment/index.ts`
- Plan: `.gsd/workflows/refactors/260526-1-we-need-to-refactor-the-image-generation/PLAN.md`
