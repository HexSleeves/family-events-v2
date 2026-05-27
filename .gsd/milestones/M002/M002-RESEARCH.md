# M002 — Research

**Date:** 2026-05-27

## Summary

This milestone refactors Unsplash image fallback search from "always append ' family' suffix" to "two-pass search: try narrow first, fall back to broad." Current implementation at line 256 in `supabase/functions/_shared/unsplash.ts` appends " family" to every search term, which dilutes activity-specific queries ("yoga family" returns family portraits instead of yoga class photos). The two-pass approach preserves relevance for clear activity events while maintaining coverage for obscure terms.

The codebase is small, well-tested, and straightforward. The change is a narrow refactor within one exported function (`findFallbackImage`), with comprehensive vitest test coverage already in place. The implementation has clear separation of concerns: title normalization is already factored out into `deriveTitleSearchTerm()`, search execution is a simple loop over candidate terms, and the random selection + attribution flow is unchanged. API rate limits are not a concern — current usage is ~2400 requests/day against a 5000/hour limit; doubling search attempts per event still keeps the project comfortably under.

**Recommendation:** Single slice delivering the two-pass search logic, updated tests, and manual verification with sample events. No new infrastructure, no database changes, no API configuration required — this is a contained behavior change with strong test coverage and clear observable success criteria.

## Recommendation

Implement two-pass search within the existing `findFallbackImage()` function. The refactor is mechanical: for each search term (title-derived or tag slug), try the bare term first. If that returns empty results, try again with " family" suffix. This preserves the existing search term ordering (title-first, then tags in confidence DESC) and selection strategy (random from per_page=5 results).

**Why this approach:**
- Minimal code delta — one function, one loop, one conditional retry per term.
- Existing tests already cover search term ordering, fallback behavior, empty result handling, and random selection. The two-pass logic slots in cleanly with new test cases for "no-suffix hit" and "suffix fallback" scenarios.
- No rate-limit risk — current usage is 2400 req/day vs 5000/hr limit. Doubling API calls per event (worst case: every term needs both passes) still keeps the project at ~4800 req/day, well under the hourly cap.
- Observable improvement — "Yoga in the Park" events will get yoga/outdoor photos (not family portraits), "Splash Park" events will get water-play images (not generic park landscapes). Success is visible in production image URL patterns and manual spot-checks after deploy.

## Implementation Landscape

### Key Files

- `supabase/functions/_shared/unsplash.ts` (lines 200-280) — `findFallbackImage()` is the sole change target. Current implementation builds a search queue (title-derived term, then tag slugs), iterates once with " family" suffix hardcoded at line 256. Refactor: for each term, try bare search first; if `results.length === 0`, retry with suffix. Keep existing attribution extraction, random selection, and error handling unchanged.
  
- `supabase/functions/_shared/unsplash.test.ts` — Existing test coverage is comprehensive (20+ cases). Add tests for: (1) two-pass behavior (first query hits → no second query), (2) suffix fallback (first query misses → second query with suffix succeeds), (3) both queries miss → continue to next term. Mock fetch to return different responses per URL to verify pass sequencing.

- `supabase/functions/backfill-event-enrichment/index.ts` (line 194) — Caller passes `{ title: row.title }` option to `findFallbackImage()`. No changes needed at call site; two-pass logic is internal to the search function.

### Build Order

1. **Prove the two-pass logic works first** — Add new test cases covering the two-pass scenarios (no-suffix hit, suffix fallback, both miss). Run tests to establish baseline before refactor. Vitest tests in `_shared/` are executed via `turbo run test` from root or directly via `vitest run` if a vitest config exists at supabase/functions level (none found currently — tests likely run via root monorepo vitest setup picking up supabase/functions/_shared/*.test.ts).

2. **Refactor `findFallbackImage()` to implement two-pass** — For each search term in the queue, attempt search with bare term. If `results.length > 0`, pick randomly and return (same as current behavior). If `results.length === 0`, retry with `${searchTerm} family`. Only on second miss do we continue to the next term. This doubles the maximum API calls per event from N (where N = 1 title term + M tag slugs) to 2N, but the typical case (first or second term hits on first pass) stays at 1-2 calls.

3. **Verify test coverage reflects the change** — Existing tests verify search term ordering, random selection, attribution parsing, error handling, and empty-result fallthrough. New tests must verify the two-pass sequencing: (a) first pass hits → no second query fired, (b) first pass misses → second query with suffix fired, (c) both passes miss → next term tried. Mock fetch to return different result shapes per URL to confirm pass order.

4. **Manual verification with sample events** — After deploy to staging, spot-check event image URLs for activity-specific terms ("Yoga in the Park" → yoga/outdoor images, "Splash Park" → water-play images, "Mom Walks" → walking/trail images). Check Supabase edge function logs for Unsplash API response counts to confirm two-pass behavior is active and not causing rate-limit warnings.

### Verification Approach

**Unit tests** (primary):
- `vitest run` from root (via turbo) or from supabase/functions if vitest config exists there.
- Existing tests verify baseline behavior; new tests verify two-pass sequencing.
- Test command: `pnpm run test` at root triggers turbo's test task for all workspaces. If `supabase/functions/_shared/*.test.ts` is not picked up, may need to add a vitest config at `supabase/functions/vitest.config.ts` or run tests via Deno (tests import vitest, so likely they're run via Node vitest, not Deno's test runner).

**Manual QA** (secondary):
- Deploy to staging, trigger backfill cron (`POST /backfill-event-enrichment` via service role key).
- Query events with activity-specific titles (`SELECT id, title, images FROM events WHERE title ILIKE '%yoga%' OR title ILIKE '%splash park%' OR title ILIKE '%mom walks%' LIMIT 10`).
- Visually inspect image URLs — activity-specific photos indicate the two-pass logic is working (first pass without " family" suffix is hitting).

**Rate-limit check**:
- Monitor edge function logs for HTTP 429 responses from Unsplash. Current usage is ~2400 req/day (25 events per 15-minute cron = 2400/day). Two-pass worst case doubles this to 4800 req/day, still under the 5000/hour limit (120,000/day). No rate-limit warnings should appear in production logs after deploy.

## Constraints

- **Vitest test runner setup** — Tests import from `vitest` but there's no `vitest.config.ts` at `supabase/functions/` level. Tests are likely run via root monorepo vitest setup (turbo delegates to per-package vitest configs at `packages/*/vitest.config.ts` and `apps/web/vitest.config.ts`). If `supabase/functions/_shared/*.test.ts` is not auto-discovered, may need to add a vitest config at `supabase/functions/vitest.config.ts` or confirm tests are run via Deno (unlikely given vitest imports).

- **Deno edge runtime** — Functions run on Deno edge runtime, but tests use Node-based vitest. The test file imports (`import { describe, expect, it, vi } from "vitest"`) indicate tests are executed in a Node environment, not Deno's native test runner. No compatibility concerns for the refactor itself (standard TypeScript, no Node/Deno-specific APIs in the change).

- **Unsplash API rate limit** — 5000 requests/hour on demo tier. Current usage: 25 events per 15-minute cron = 100 events/hour = ~100-200 API calls/hour (one search per event, some miss and try multiple terms). Two-pass worst case: 200-400 API calls/hour, still comfortably under limit. No configuration change needed; existing `UNSPLASH_ACCESS_KEY` env var is sufficient.

- **Search term ordering is load-bearing** — Existing behavior tries title-derived term first, then tag slugs in confidence DESC order. This ordering must be preserved in the two-pass refactor. The title term is more specific than tags (e.g. "Splash Park" title → "splash park" vs "outdoor-play" tag), so trying it first (with and without suffix) before falling back to tags is correct.

## Common Pitfalls

- **Off-by-one in query count** — If the two-pass logic is implemented incorrectly, the function could fire both passes for every term even when the first pass hits. Guard: add tests verifying the fetch mock is called once per term when results are found on first pass.

- **Breaking random selection** — The existing code picks randomly from `per_page=5` results to avoid every event with the same term getting the identical photo. The two-pass refactor must preserve this: if first pass hits, pick randomly from first-pass results; if second pass hits, pick randomly from second-pass results. Don't accidentally pick from a merged result set or reset randomness between passes.

- **Attribution metadata survival** — The function returns `{ url, matchedTag, attribution }` where `attribution` is extracted from the hit via `attributionFromHit()`. The two-pass logic must preserve attribution regardless of which pass succeeded. This is already correct in the current implementation (attribution is extracted from the chosen hit, not the query); just verify tests cover attribution on both passes.

- **Empty result vs error** — Unsplash API returns `{ results: [] }` for no matches vs throwing/returning non-2xx for errors. The current code treats `results.length === 0` as "try next term" and non-2xx as "try next term" (swallows errors in catch block). The two-pass logic must preserve this: first pass returns `results: []` → retry with suffix; second pass returns `results: []` → try next term. Don't accidentally treat empty as terminal failure.

## Open Risks

- **Unclear test execution path** — Tests use vitest imports but there's no vitest config at `supabase/functions/` level. If tests aren't auto-discovered by the root turbo setup, they may not run at all currently. Mitigation: run `pnpm run test` from root and verify tests execute. If not, add a vitest config at `supabase/functions/vitest.config.ts` or confirm the monorepo setup discovers these tests via glob pattern.

- **Rate limit headroom assumption** — The 5000/hour limit is comfortable for current usage, but if other features start using Unsplash (e.g. scraper fallback for source images, user-uploaded event image suggestions), the two-pass doubling could hit limits. Mitigation: after deploy, monitor edge function logs for 429 responses. If rate limits become a concern, can throttle by reducing cron frequency or adding a per-event delay.

- **Manual verification requires populated staging DB** — The success criteria rely on seeing activity-specific images in production/staging. If the staging DB has sparse event data (no "Yoga in the Park" or "Splash Park" events), manual verification will be limited. Mitigation: after deploy to production, spot-check a sample of events with activity-specific titles to confirm image relevance improved.

## Sources

- Existing implementation: `supabase/functions/_shared/unsplash.ts` lines 200-280
- Test coverage: `supabase/functions/_shared/unsplash.test.ts` (20+ test cases covering search ordering, random selection, attribution parsing, error handling)
- Backfill caller: `supabase/functions/backfill-event-enrichment/index.ts` line 194 (passes `{ title: row.title }` option)
- Database migration context: `supabase/migrations/20260601004000_llm_review_and_enrichment.sql` (added `tags text[]` column to enrichment RPCs, ordered by confidence DESC)
- Unsplash API docs: https://unsplash.com/documentation (rate limits, search endpoint, download tracking)
- Project rate-limit usage: cron runs every 15 minutes with 25-event batches = ~2400 requests/day vs 5000/hour limit