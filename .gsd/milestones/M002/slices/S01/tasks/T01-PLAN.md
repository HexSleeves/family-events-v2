---
estimated_steps: 8
estimated_files: 1
skills_used: []
---

# T01: Implemented two-pass Unsplash search loop: bare activity terms first, " family" suffix fallback only when bare returns empty

Why: Current implementation always appends ' family' to every search term, diluting activity-specific queries. A 'Yoga in the Park' search becomes 'yoga in the family' which returns generic family photos instead of yoga/outdoor images.

Do:
1. Modify the search loop in findFallbackImage() to try each term twice: first bare (e.g. 'splash park'), then with ' family' suffix if bare returns empty.
2. Keep the existing random selection logic (Math.floor(Math.random() * results.length)).
3. Keep the existing attribution extraction and error handling unchanged.
4. Ensure the matchedTag field reflects the actual term that succeeded (bare or suffixed).
5. Do NOT change the search queue order (title-derived term first, then tag slugs).

Done when: The function tries bare terms first, falls back to ' family' suffix only when bare returns empty, and returns the first successful match with correct attribution.

## Inputs

- `supabase/functions/_shared/unsplash.ts`

## Expected Output

- `supabase/functions/_shared/unsplash.ts`

## Verification

pnpm --filter @family-events/supabase test -- unsplash.test.ts

## Observability Impact

The matchedTag field will now show whether a bare term ('splash park') or suffixed term ('splash park family') matched, providing visibility into which pass succeeded.
