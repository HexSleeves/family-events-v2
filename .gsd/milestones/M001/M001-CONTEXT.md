# M001: iOS Parity + Geocoding Hardening

**Gathered:** 2026-05-26
**Status:** Ready for planning

## Project Description

family-events-ui is a production family-events product with web, iOS, and Railway cron infrastructure backed by Supabase. Parents discover and plan local events for their children. The product is live and receiving incremental hardening.

## Why This Milestone

Two concrete pain points are blocking product quality:

1. **iOS Explore is severely behind web.** The age filter, tag/category filter sheet, and category grid chips are entirely absent. iOS users see a flat list with only date and free-only filters — web has 5 age buckets, 4 category chips, full tag multi-select, and a category grid. Additionally, iOS is still calling `events_enriched` (v1) while web moved to `events_enriched_v2`, missing cursor pagination, `parent_tips`, and `is_outdoor` columns.

2. **The map is bare despite events existing.** The geocoding enrichment pipeline (Nominatim via `backfill-event-enrichment` edge function, every 15 minutes via Railway cron) leaves many events at city-centroid placeholder coordinates. The `isCityCentroidCoordinate()` guard filters those off the map entirely. Two recent migrations (`009600`, `009700`) improved the geocodable-address heuristic but the map is still sparse, suggesting more address patterns are failing to match or that the enrichment queue is not keeping up.

## User-Visible Outcome

### When this milestone is complete, the user can:

- Open iOS Explore and filter events by age bucket (0-1yr through 9+), category chip (Playgroups, Music, Outdoor, Storytime), or tag — matching web's filter vocabulary.
- See notably more pinned events on the map view because more events have resolved coordinates.
- (Developer) Verify geocoding coverage improvement via a before/after query showing centroid-stuck event counts.

### Entry point / environment

- Entry point: iOS app (FEExplore package, ExploreScreen/ExploreFilters/ExploreViewModel) + Supabase SQL migration
- Environment: Local dev for iOS + Supabase local dev for migration; production Supabase for geocoding fix
- Live dependencies involved: Supabase `events_enriched_v2` RPC, Nominatim geocoder, Railway enrichment cron

## Completion Class

- Contract complete means: iOS Explore filter sheet includes age and tag sections; `EventDTO` decodes `parentTips`/`isOutdoor`; geocoding migration applied locally and passes `supabase db reset`.
- Integration complete means: iOS calls `events_enriched_v2` successfully; client-side filter logic produces correct subsets against real data.
- Operational complete means: Geocoding migration deployed to production Supabase; centroid-stuck event count measurably reduced.

## Final Integrated Acceptance

To call this milestone complete, we must prove:

- iOS Explore filter sheet opens, age filter chips match web's buckets, selecting a category chip narrows the visible event list.
- `EventDTO.parentTips` and `EventDTO.isOutdoor` decode correctly from a v2 RPC response.
- A SQL query run against local DB (after migration) shows fewer events matching the centroid-stuck predicate than before.
- `useEvents` hook and `search_events` RPC are deleted or wired — no dangling TODO state.

## Architectural Decisions

### Tag/age filtering stays client-side on iOS (matches web)

**Decision:** iOS `ExploreViewModel.applyClientFilters` applies age and tag filters on the fetched `[EventDTO]` slice, not via RPC params.

**Rationale:** `events_enriched_v2` has no `p_tag_slugs` or `p_age_min`/`p_age_max` params. Web does the same — it fetches a city/date window and filters client-side. Adding server-side params would require a DB migration and schema change that is not worth the scope here; client-side filtering on a 100-event page is fast enough.

**Alternatives Considered:**
- Add `p_tag_slugs`/`p_age_min`/`p_age_max` to `events_enriched_v2` — not chosen; adds migration complexity with no user-visible benefit at current scale.

### iOS migrates from events_enriched to events_enriched_v2

**Decision:** `SupabaseEventRepository.fetchList` switches from `events_enriched` to `events_enriched_v2` with cursor pagination support. `EventDTO` gains `parentTips` and `isOutdoor` optional fields.

**Rationale:** Web already uses v2. Staying on v1 means iOS silently misses `parent_tips` and `is_outdoor` and does not benefit from v2's cursor-based pagination. The v2 param set is a superset of v1 — migration is mechanical.

**Alternatives Considered:**
- Keep v1 and manually backfill fields — rejected; would require maintaining two code paths indefinitely.

### Geocoding heuristic: widen address signal, not fallback strategy

**Decision:** The `_has_geocodable_address` predicate in `list_events_needing_enrichment` is widened to capture more real addresses, rather than adding a city-centroid fallback write-back.

**Rationale:** The comment in `backfill-event-enrichment/index.ts` is explicit: writing the centroid back re-flags the row as `needs_coords` and starves other rows. The better fix is making the predicate more precise. The last two migrations already improved this; this milestone continues in that direction.

**Alternatives Considered:**
- City-centroid fallback write-back — rejected per existing code comment; causes claim-queue starvation.
- Switch geocoder from Nominatim to Google Maps API — out of scope; requires API key billing, policy change.

## Error Handling Strategy

- iOS filter changes are purely client-side on already-fetched data — no new network error surface.
- `events_enriched_v2` RPC errors propagate via the existing `AppError` path in `ExploreViewModel`.
- Geocoding migration is a `CREATE OR REPLACE FUNCTION` wrapped in `BEGIN/COMMIT` — safe to rerun; no destructive DDL.
- Dead code removal (S03) carries no runtime risk — it is unreferenced code.

## Risks and Unknowns

- iOS `events_enriched_v2` column set includes `is_outdoor` and `parent_tips` as `jsonb` — need to confirm `EventDTO` decoding handles nullable jsonb correctly without crashes.
- Geocoding heuristic widening may re-introduce some libcal room-label false positives (noted in migration `009700`) — acceptable given the attempt-timestamp rotation keeps them from starving the queue.
- `search_events` RPC deletion requires confirming it has no callers outside web (admin, cron, edge functions) before dropping.

## Existing Codebase / Prior Art

- `apps/ios/Packages/FEExplore/Sources/FEExplore/` — ExploreScreen, ExploreViewModel, ExploreFilters, ExploreFilterSheet. All need modification.
- `apps/ios/Packages/FEData/Sources/FEData/DTOs/EventQuery.swift` — needs `tagSlugs` and `ageMin`/`ageMax` only if we decide to pass them (we don't — client-side).
- `apps/ios/Packages/FEData/Sources/FEData/Repositories/EventRepository.swift` — switch RPC name to `events_enriched_v2`, add cursor params.
- `apps/ios/Packages/FEData/Sources/FEData/DTOs/EventDTO.swift` — add `parentTips`/`isOutdoor` optional fields.
- `apps/web/src/features/explore/constants/categories.ts` — source of truth for category slugs/labels to mirror on iOS.
- `apps/web/src/features/events/lib/event-filters.ts` — `matchesAgeFilter` logic to port to Swift.
- `supabase/migrations/20260601009700_enrichment_geocodable_address_expand.sql` — last geocoding heuristic migration; new migration extends this.
- `supabase/functions/backfill-event-enrichment/index.ts` — geocoding edge function; read before writing heuristic migration.
- `apps/web/src/hooks/use-events.ts` + `supabase/migrations/*search_events*` — dead code to remove.

## Relevant Requirements

- R001 — iOS age filter
- R002 — iOS tag/category filter
- R003 — iOS category grid chips
- R004 — Geocoding pipeline reliability
- R005 — Map shows events with real coords
- R006 — Geocoding observability
- R007 — Dead code resolved
- R008 — iOS on events_enriched_v2

## Scope

### In Scope

- iOS `ExploreFilters` struct: add `ageFilter` and `tagSlugs`/`activeCategory` fields
- iOS `ExploreViewModel.applyClientFilters`: add age and tag filter logic (port `matchesAgeFilter` to Swift)
- iOS `ExploreFilterSheet`: add Age section and Tags/Categories section
- iOS `ExploreScreen`: add inline category grid chips between search bar and list
- iOS `ExploreActiveFiltersBar`: show age and tag active-filter chips with dismissal
- iOS `SupabaseEventRepository`: switch to `events_enriched_v2`, add `EventDTO.parentTips`/`isOutdoor`
- Supabase migration: widen `_has_geocodable_address` heuristic, add diagnostic query for centroid-stuck events
- Web: delete or wire `useEvents` hook + `search_events` RPC

### Out of Scope / Non-Goals

- Android parity (separate milestone)
- Server-side tag/age params on `events_enriched_v2`
- Switching geocoder provider
- RLS integration tests
- iOS snapshot testing harness
- Production cron env auto-injection

## Technical Constraints

- iOS: feature packages must not import Supabase directly — all data access through `FEData` protocols.
- iOS: `ExploreFilters` must remain `Equatable` and `Sendable` (used by `ExploreViewModel.didSet` for reactive reload).
- Geocoding migration must be `BEGIN/COMMIT` wrapped and idempotent (`CREATE OR REPLACE FUNCTION`).
- `search_events` RPC drop must confirm zero callers in edge functions, cron scripts, and admin before executing.

## Integration Points

- `events_enriched_v2` Supabase RPC — iOS will call this; v2 is already live in production.
- `ExploreViewModel` ↔ `ExploreFilters` — reactive: `didSet` on filters triggers reload. New fields must flow through this.
- `ExploreFilterSheet` ↔ `ExploreFilters` binding — sheet mutates shared filter state.
- `backfill-event-enrichment` edge function — geocoding heuristic migration changes what rows the function sees; no function code change needed.

## Testing Requirements

- iOS: `ExploreViewModel` unit tests for `applyClientFilters` covering age bucket boundaries, tag slug matching, and combined filters.
- iOS: `EventDTO` decode test for `parentTips`/`isOutdoor` nullable fields.
- Geocoding: SQL diagnostic query run before and after migration on local DB shows count change.
- Dead code: `pnpm --filter @family-events/web check` passes with no references to deleted hook/RPC.

## Acceptance Criteria

**S01 (iOS Explore Parity):**
- `ExploreFilterSheet` has Age and Category/Tags sections
- Selecting age bucket 0-1yr on iOS returns only events where `age_max >= 0 && age_min <= 1`
- Selecting "Playgroups" category chip filters to events tagged with slug `playgroup`
- Category chips appear inline in `ExploreScreen` between search bar and event list
- Active age/tag filters show dismissible chips in `ExploreActiveFiltersBar`
- `EventDTO` decodes `parentTips` and `isOutdoor` without crash on nil
- iOS calls `events_enriched_v2` (verify via Supabase logs or breakpoint)

**S02 (Geocoding):**
- New migration applies cleanly: `supabase db reset` passes locally
- Diagnostic SQL shows centroid-stuck event count before vs after migration
- Migration comment explains the new heuristic additions

**S03 (Dead Code):**
- `useEvents` hook file deleted
- `search_events` RPC migration either rolled back or explicitly dropped
- `pnpm --filter @family-events/web check` passes

## Open Questions

- `parent_tips` column type in `events_enriched_v2` is `jsonb` — need to confirm the exact shape to model `EventDTO.parentTips` correctly in Swift. Check the migration `009702_parent_tips.sql` for the return type before implementing.
- Whether `search_events` has any callers in edge functions or cron scripts beyond web — grep required before dropping.
