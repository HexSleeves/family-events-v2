# Spike: Event Photo Relevance — Fixing the Unsplash Fallback

**Date:** 2026-05-27  
**Trigger:** Splash park event shows a Christmas ornament image.

---

## Problem Statement

When events have no scraped image, the backend fetches a fallback from Unsplash by
querying `{tag-slug} family` (e.g. `"sports family"`, `"outdoor family"`). The
result is stored in `events.images[]` and shown on every card variant.

**The bug:** The Unsplash fallback uses the event's *classified tags* (e.g.
`sports`, `outdoor`) not the event's *actual subject* (e.g. "splash park", "water
play"). Tag slugs like `sports` and `outdoor` are broad and seasonal — a query for
`"sports family"` can return a Christmas ornament, winter festival, or anything
else Unsplash chose as its highest-relevance photo that day. The image is cached
in the DB permanently, so once a bad photo lands it stays.

The current tag list (`classification.ts` / `tags` table) has no `water`,
`splash`, `pool`, or `aquatic` entry, so a "Splash Park" event gets tagged
`sports` or `outdoor` — then the Unsplash query retrieves an irrelevant photo.

---

## Success Criteria

A good answer will provide:
1. **Root cause confirmation** — exactly where in the pipeline bad photos get selected
2. **A concrete fix recommendation** — what changes to make (tag expansion, query
   strategy, or both) and where they live in the codebase
3. **Assessment of blast radius** — how many events are affected and whether a
   backfill is needed

---

## Research Angles

### Angle 1 — Improve the Unsplash query strategy
Current: `"{tag-slug} family"` (tag slug is coarse, seasonal results)  
Investigate: Use event **title** or venue name as the Unsplash search term instead
of (or in addition to) the tag slug; add `content_filter=high` result ordering; add
`per_page > 1` with round-robin selection to reduce "always the same photo" issue.

### Angle 2 — Expand the tag vocabulary for water/aquatic events
Current: No `water-play`, `splash-pad`, or `swim` tag exists. "Swim" only appears
as a keyword inside the `sports` tag rule. The LLM picks `sports` or `outdoor`,
both of which return generic photos.  
Investigate: Add targeted tags (`water-play`, `pool`, `splash-pad`) whose slugs
double as better Unsplash search terms. Assess migration effort.

### Angle 3 — Smarter per-event photo term derivation (title/description NLP)
Current: Unsplash query = first matching tag slug.  
Investigate: Derive the Unsplash search term from the event title/description
directly (e.g. extract "splash park", "petting zoo", "storytime") — either via a
simple keyword extraction in the enrichment function or a small additional LLM
call — instead of relying solely on the tag slug.

---

## Constraints

- No new paid APIs — Unsplash is already in use; stay in its rate limits (~5000/hr)
- Changes must land in the Supabase edge function layer (`backfill-event-enrichment` +
  `_shared/unsplash.ts`) and/or `_shared/classification.ts`; frontend `event-card.tsx`
  currently falls back to `picsum.photos` when `images` is empty — that is an
  acceptable last-resort but shouldn't be the everyday path
- Existing `event_image_attributions` data must remain valid (no breaking schema changes)
