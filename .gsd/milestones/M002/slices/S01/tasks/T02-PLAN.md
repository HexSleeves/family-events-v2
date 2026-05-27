---
estimated_steps: 9
estimated_files: 1
skills_used: []
---

# T02: Add test coverage for two-pass scenarios

Why: The two-pass logic introduces new code paths that existing tests do not cover: bare term hits immediately, bare term misses but suffix succeeds, both passes miss.

Do:
1. Add test: 'uses bare term when it returns results (no suffix needed)'.
2. Add test: 'falls back to suffix when bare term returns empty'.
3. Add test: 'returns null when both bare and suffixed queries return empty'.
4. Add test: 'matchedTag reflects the term that actually succeeded (bare vs suffixed)'.
5. Use mockFetch to control responses per query string.
6. Verify all 20+ existing tests still pass.

Done when: All existing tests pass, and the four new test cases cover the two-pass behavior with clear assertions on matchedTag and search order.

## Inputs

- `supabase/functions/_shared/unsplash.ts`
- `supabase/functions/_shared/unsplash.test.ts`

## Expected Output

- `supabase/functions/_shared/unsplash.test.ts`

## Verification

pnpm --filter @family-events/supabase test -- unsplash.test.ts
