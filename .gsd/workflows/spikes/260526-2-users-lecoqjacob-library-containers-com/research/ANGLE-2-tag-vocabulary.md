# Angle 2: Expand the Tag Vocabulary for Water/Aquatic Events

**Question:** Would adding better tags (`water-play`, `splash-pad`, etc.) fix the photo problem?

---

## Current Tags in DB (migration 20260601001000)

| Slug | Category | Activity |
|------|----------|----------|
| free, outdoor, indoor, toddler-friendly, baby-friendly, teen-friendly | location/cost/age | — |
| weekend, educational, sensory-friendly, family-festival, holiday, community, nature | theme | — |
| arts-crafts, music, storytime, stem, sports, cooking, playgroup | activity | — |

**No water, aquatic, splash, pool, or swim tag exists.**

## Current Keyword Rules (`classification.ts`)

- `sports`: includes `"swim"` — so "Swim Lessons" → `sports` tag (not helpful for Unsplash)
- `outdoor`: includes `"park"` — so "Splash Park" → `outdoor` tag
- `sensory`: includes `"water play"` — so exact phrase "water play" → `sensory` tag
- **None of these produce a good Unsplash photo** when used as query terms

## What Would Happen with Better Tags

If we added a `water-play` tag with keywords: `splash`, `splash pad`, `splash park`,
`water park`, `pool`, `swim`, `aquatic`, `water play`, `wading pool`:

1. "Splash Park" event → classified as `water-play` (confidence ~0.8)
2. Unsplash query: `"water-play family"` → still mediocre (hyphen in slug is a problem)
3. Or: `"water play family"` → likely good results ✓

But this alone doesn't fix it for the splash park case unless we ALSO either:
- Map the slug to a human-readable Unsplash query term (separate from the slug itself), OR
- Use the title directly (Angle 1)

## Tag Slug as Unsplash Query — The Coupling Problem

The `findFallbackImage` function uses the tag slug directly as the search term:

```ts
const query = `${tag} family`  // tag = "water-play"
```

Slugs use hyphens, which are ignored by Unsplash's search parser. So:
- `"water-play family"` effectively becomes `"water play family"` → probably fine
- `"arts-crafts family"` → `"arts crafts family"` → ok
- `"toddler-friendly family"` → terrible query

This means tag slugs are tolerable but not ideal as search terms. A dedicated
`unsplash_query` field per tag (or a separate mapping) would be cleaner.

## Migration Cost Assessment

Adding a new tag requires:
1. New migration to `INSERT INTO public.tags` with the new slug + name + color
2. New keyword rules in `_shared/classification.ts` TAG_RULES array
3. New test coverage in `_shared/classification.test.ts`
4. Existing events already tagged `sports` or `outdoor` are NOT retroactively
   re-tagged — a reclassify job or manual re-tagging would be needed

**That's the real problem with pure tag expansion:** even if we add `water-play`
today, the "Splash Park" event already has `sports` or `outdoor` written in
`event_tags` and the classification won't re-run unless someone triggers
`tag-event` again or a reclassify cron runs.

## Verdict

Tag vocabulary expansion is **useful long-term** but does NOT fix the immediate
problem because:

1. The coupling between tag slug and Unsplash query term is fragile
2. Existing events are already misclassified and won't benefit without a reclassify pass
3. Even with a new tag, the slug-as-query-term approach is still an indirect mapping

**Better tags improve classification quality** (which is a separate goal), but
they don't fully solve the photo relevance problem by themselves.

**Confidence level: MEDIUM** for this angle as a standalone fix. HIGH as a
complement to Angle 1 (title-first query).

**Recommendation:** Add water-related tags for better classification accuracy,
but treat it as a follow-up to the primary fix (Angle 1). Don't block on it.
