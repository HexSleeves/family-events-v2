# Event Image Fallback via Unsplash — Design Spec

**Date**: 2026-05-23
**Owner**: TBD
**Status**: Draft (awaiting review)
**Depends on**: `2026-05-23-ios-web-parity-design.md` (iOS `SafeImageURL` already routes through the `images` jsonb column)

## Problem

Scraped events frequently land with `events.images = []` (empty jsonb array) or with URLs that fail to load (404, hot-link blocked, http-only, malformed). The iOS+web+Android consumer surfaces all fall back to a `picsum.photos` stock placeholder seeded by event ID — a generic landscape/abstract photo that doesn't match the event content. That undermines the "this product knows my neighborhood" promise: a fishing event renders a mountain stock photo, a museum event renders a beach, etc.

User explicitly asked for an event-matched fallback. LLM image generation was considered and rejected (cost, latency, brand drift, kid-imagery moderation risk). Stock photo lookup keyed by the event's existing `tags` column is a better fit because:

- `tags` already exist on every published event.
- Same provider URL → same image bytes deterministically.
- Server-side write: web, iOS, and Android consume `events.images` unchanged, no per-client work.
- Reversible: provider can change without touching clients.

## Goals

- Fill `events.images[0]` for every event in scope so cards render a semantically-related photo on first paint.
- Match the event by its primary tag (highest-confidence tag from the existing tag pipeline).
- Stay within Unsplash's free tier (5000 req/hr) and within the existing `cron-enrich-events` 90s wall budget.
- Backfill **featured rows + rows whose `start_datetime` is within now…now+30d**, then keep new scrapes covered going forward.
- Surface required Unsplash app-credit attribution on web.

## Non-goals

- Per-photo photographer credit on individual cards (Unsplash TOS asks for it "where reasonable"; app-list credit on `/profile` or `/about` is sufficient legally).
- Replacing real event photos when they exist and load — `SafeImageURL` still picks `images[0]` first.
- LLM image generation. Out of scope this round.
- Image hosting / self-rehost. We persist Unsplash CDN URLs; if Unsplash takes a photo down, the client fallback (`picsum.photos` seeded placeholder, then photo-glyph) still works.
- Android client changes — the existing image rendering path on Android already reads `events.images`; no client work required.

## Current state

- `events.images` is `jsonb` (max 20 entries) per `supabase/migrations/20260601000000_consolidated_schema.sql:264`.
- `supabase/functions/backfill-event-enrichment/index.ts:119-150` already has a `needs_images` branch but it's a no-op shim — `sanitizeImagesForIngest` is called with an empty `images` array because the original parsed images aren't preserved. The comment acknowledges this is awaiting a real impl.
- `cron-enrich-events` Railway service runs every 15 min, hits the edge fn via `BACKFILL_EVENT_ENRICHMENT_URL`.
- `list_events_needing_enrichment` RPC returns rows where `images IS NULL OR jsonb_array_length(images) = 0`. Already keyed off the right condition.
- iOS / web / Android consumers all route image rendering through the `images[0]` value with `picsum.photos` as final fallback (web: `apps/web/src/features/plan/components/plan-hero-card.tsx`, iOS: `FECore.SafeImageURL`).

## Target architecture

### Provider integration

Add an `unsplashFallback` step inside `enrichOne` (`backfill-event-enrichment/index.ts`):

```ts
if (row.needs_images && images.length === 0 && row.tags.length > 0) {
  images = await unsplashFallback(row.tags, row.title)
}
```

`unsplashFallback`:

1. Pick `tags[0]` (already ranked by confidence in the tag-queue pipeline).
2. `GET https://api.unsplash.com/search/photos?query=<tag>+family&orientation=landscape&per_page=1`
   with `Authorization: Client-ID <UNSPLASH_ACCESS_KEY>`.
3. If a result exists, take `results[0].urls.regular` (1080-wide CDN-served JPEG).
4. Trigger the required Unsplash download tracking endpoint (`GET results[0].links.download_location` — needed per Unsplash API guidelines but does not consume rate limit).
5. Return `[regular_url]` or `[]` on failure.

Failure modes (404 from Unsplash, rate-limited, no results, network error) all return `[]` and the row stays on the "needs images" list for the next tick — same recovery shape as the existing geocode branch.

### Tag access in `EventNeedingEnrichment`

Extend `list_events_needing_enrichment` SQL function (new migration) so the returned row includes a `tags text[]` field (joined from `event_tags` + `tags` tables, ordered by confidence DESC). The TS type gains `tags: string[]`.

### Backfill scope SQL

New RPC `backfill_image_enrichment_in_scope(p_limit int)` lists rows where:

```sql
images IS NULL OR jsonb_array_length(images) = 0
AND (
  is_featured = true
  OR start_datetime BETWEEN now() AND now() + interval '30 days'
)
AND status = 'published'
ORDER BY is_featured DESC, start_datetime ASC
LIMIT p_limit
```

The cron tick switches to this scoped RPC. After backfill catches up (likely within hours given 25/tick × 96 ticks/day = 2400/day), the new-scrape flow also lands in this set automatically as events get scraped and slot into the next 30 days.

> **Why a separate scoped RPC, not a flag on the existing one?** The existing `list_events_needing_enrichment` is also called by coords-only flows that should NOT be date-windowed (coords need filling regardless of how soon the event runs). Keeping them separate avoids cross-coupling those two concerns.

### Environment + secrets

Add to Railway `cron-enrich-events` service AND to the edge fn:

- `UNSPLASH_ACCESS_KEY` — registered Unsplash app key.
- Local dev: add to `.env.development.local` template.

Existing edge-fn deploy via `scripts/deploy.sh` already handles env-var pushes (`--skip-deploys` flag).

### Web attribution

Per Unsplash API guidelines, the app must surface a credit line. Add to `apps/web/src/features/profile/components/profile-about.tsx` (or wherever app-credit copy lives — to be located during impl) a single line:

> "Some event photos courtesy of [Unsplash](https://unsplash.com/?utm_source=family_events&utm_medium=referral)."

That single sentence satisfies the API guidelines as written.

### iOS / Android attribution

Add the same one-liner to iOS `ProfileSheet` (existing "About" section or a new one) + Android profile screen. **Not blocking for this spec's implementation** — can land in a follow-up commit since the URLs already flow through and the app-credit line is the only requirement.

## Data flow

```
[scraper writes event row with images=[]]
              │
              ▼
[cron-enrich-events tick (every 15 min)]
              │
              ▼
[edge fn backfill-event-enrichment]
              │
   ┌──────────┴──────────┐
   │                     │
   ▼                     ▼
[geocode coords]    [tags-keyed Unsplash search → 1 URL]
   │                     │
   └──────────┬──────────┘
              ▼
[update_event_enrichment RPC writes events.images]
              │
              ▼
[web/iOS/Android cards render images[0] on next refetch]
```

## Sequencing

1. Migration `2026-05-24-add-tags-to-events-needing-enrichment.sql`: extend `list_events_needing_enrichment` return shape to include `tags`. Add new RPC `backfill_image_enrichment_in_scope(p_limit int)`.
2. Edge fn `backfill-event-enrichment/index.ts`: new `unsplashFallback()` helper; wire into `enrichOne`; switch the cron tick to call the new scoped RPC (path arg or feature flag).
3. Railway env: `UNSPLASH_ACCESS_KEY` set on `cron-enrich-events` service.
4. Edge-fn secret: same key set via Supabase Studio.
5. Web Profile/About: Unsplash attribution one-liner.
6. Verification: tick once on local Supabase against a small seeded event set; assert `images[0]` gets populated and matches the tag.

## Risks + mitigations

- **Rate limit (5000/hr)**: with 25 events/tick × 96 ticks/day = 2400/day, we're well under. If we ever cross, the edge fn already swallows per-row errors and the row stays on the queue. Future: cache by tag (one Unsplash result per tag, reused across events sharing it).
- **Inappropriate image for a kid-event tag**: Unsplash safe-search is on by default for authenticated calls. We append `family` to every query as an additional signal. If a single tag like `concert` returns an adult-coded photo, that's caught manually via the existing admin event-review flow — the operator can clear `events.images` and the cron re-enriches.
- **Unsplash takes a photo down**: `SafeImageURL` already covers it on every client (photo glyph fallback). No regression vs. today.
- **Unsplash key leaked**: server-side only, never shipped to clients. Rotation is one Railway + one Studio env change.
- **Cost spike**: Unsplash free tier; no cost as long as we stay under 5000/hr. No payment method on file.

## Testing strategy

- Edge-fn unit test (`supabase/functions/backfill-event-enrichment/__tests__/unsplash.test.ts`): mock Unsplash response, assert URL extraction + download-tracking call.
- Migration test (Deno test in `supabase/tests/`): seed two events (one in 7d, one in 60d), call `backfill_image_enrichment_in_scope`, assert only the 7d one is returned.
- One-shot manual verification on local Supabase: insert a `museum`-tagged event, run the edge fn, confirm `events.images[0]` resolves to an Unsplash CDN URL.
- No client changes; existing client tests still cover the `images[0]` rendering path.

## Open questions

1. Should we cache Unsplash results by tag (`tag_image_cache` table) so events sharing the same primary tag reuse the same photo? Cuts API calls and saves the photo from feeling random across cards. Could land as a phase-2 follow-up.
2. Should the Unsplash query append the city name (e.g. `museum austin family`) so the photo geographically matches? Trade-off: tighter match, but Unsplash returns fewer hits for narrow queries → more rows fall back to picsum. Recommend not now; revisit if generic results feel off.

## Success criteria

1. Within 24 hours of deploy, ≥ 90% of featured-or-next-30-days events have a non-placeholder `images[0]` URL.
2. Edge-fn p95 latency per tick stays ≤ 90s (current geocode budget + ~25 × 300ms Unsplash calls).
3. No edge-fn 5xx caused by Unsplash rate-limit / outage (errors swallowed per-row).
4. Web Profile shows the Unsplash credit line.
5. Existing `images` content is never overwritten (we only fill when `images = []`).
6. Existing client suites stay green; no UI code changes.

## Out of scope

- LLM image generation.
- Self-hosted image rehost / CDN.
- Per-card photographer credit overlay.
- Android attribution copy (deferred to a follow-up small commit).
- Replacing existing scraped images with "better" Unsplash matches.
- Tag-level image cache table (phase 2 follow-up if rate-limit pressure shows up).
