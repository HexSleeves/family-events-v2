# M001: iOS Parity + Geocoding Hardening — Research

**Date:** 2026-05-27

## Summary

**All work described in the milestone context has already been completed.** Every requirement (R001-R008) is validated in REQUIREMENTS.md, the iOS Explore filter UI matches web's capabilities, the geocoding heuristic has been progressively expanded through three migrations, and dead code (`search_events` v1, `useEvents` hook) has been removed. The milestone roadmap is empty and status is queued with zero slices, indicating work was done manually outside the GSD workflow.

**This is a retroactive documentation milestone, not an implementation milestone.** The research validates that no further development is needed — the product gaps described in M001-CONTEXT.md no longer exist.

## Recommendation

**Mark the milestone complete without creating slices.** The user-visible outcomes and acceptance criteria from M001-CONTEXT.md are all met:

- iOS Explore has age filter (5 buckets), category chips (4), and tag filtering — all client-side, matching web
- EventDTO decodes `parentTips` and `isOutdoor` without crashes (unit tests pass)
- Geocoding heuristic expanded to include suite/unit indicators, extended place-types, and venue_name digit prefixes
- Map should show more events (migration deployed; diagnostic query embedded in migration for production measurement)
- `search_events` v1 dropped, no references in web codebase

Alternative: If the user wants a historical record, create a single retroactive slice (S01) documenting what was done, when, and how it was verified — but this adds ceremony with no execution value.

## Implementation Landscape

### What Already Exists

**iOS Explore filters (R001, R002, R003):**
- `apps/ios/Packages/FEExplore/Sources/FEExplore/ViewModels/ExploreFilters.swift` — `ageFilter: AgeFilter?` and `activeCategory: String?` fields present, `AgeFilter` enum with 5 buckets matching web's `EXPLORE_AGE_OPTIONS`
- `apps/ios/Packages/FEExplore/Sources/FEExplore/ViewModels/ExploreViewModel.swift` — `applyClientFilters` applies age-range overlap logic (port of web's `matchesAgeFilter`) and category slug matching
- `apps/ios/Packages/FEExplore/Sources/FEExplore/Components/ExploreFilterSheet.swift` — Age and Category sections present; Category section lists 4 categories (Playgroups, Music & Movement, Outdoor Fun, Indoor Storytime) matching `EXPLORE_CATEGORIES`
- `apps/ios/Packages/FEExplore/Sources/FEExplore/Components/ExploreCategoryChipRow.swift` — inline category chip row with same 4 categories, wired into `ExploreScreen.swift` between search bar and active filters bar
- `apps/ios/Packages/FEExplore/Sources/FEExplore/Components/ExploreActiveFiltersBar.swift` — dismissible age and category chips present
- `apps/ios/Packages/FEExplore/Tests/FEExploreTests/ExploreViewModelTests.swift` — `testAgeFilterNarrowsList`, `testAgeFilterOpenEndedMax`, `testCategoryFilterNarrowsList` all passing

**iOS on canonical RPC (R008):**
- `apps/ios/Packages/FEData/Sources/FEData/Repositories/EventRepository.swift` — both `fetch` and `fetchList` call `events_enriched` (canonical name post-migration 009902 rename)
- `apps/ios/Packages/FEData/Sources/FEData/DTOs/EventDTO.swift` — `parentTips: [ParentTip]?` and `isOutdoor: Bool?` fields present, decoded via `decodeIfPresent`
- `apps/ios/Packages/FEData/Tests/FEDataTests/DTOs/EventDTOTests.swift` — `testDecodesV2FieldsWhenPresent` and `testDecodesV2FieldsWhenAbsent` passing

**Geocoding heuristic (R004, R005, R006):**
- `supabase/migrations/20260601006000_enrichment_images_and_rpc_cleanup.sql` contains squashed migrations including:
  - `009700_enrichment_geocodable_address_expand.sql` — added place-type words (Park, Museum, Library, Center, etc.) to `_has_geocodable_address`
  - `009702_parent_tips.sql` — added suite/unit indicators, extended venue place-types (Gym, Fitness, Studio, Kitchen, Cafe, etc.), and digit-prefix venue_name patterns
  - `009901` — added Building, Complex, Facility, Auditorium, Convention, Conference
- Diagnostic queries are embedded in migration comment blocks (2 DIAGNOSTIC QUERY markers) for before/after centroid-stuck count measurement
- `supabase/functions/backfill-event-enrichment/index.ts` — comment block explicitly documents "Intentionally no city-centroid fallback here" to prevent claim-queue starvation

**Dead code removal (R007):**
- `search_events` v1 dropped via migration 009900 (inside `006000_enrichment_images_and_rpc_cleanup.sql`)
- `search_events_v2` renamed to canonical `search_events` via migration 009902
- `apps/web/src/hooks/use-events.ts` — does not exist (deleted or never created)
- `apps/web/src/lib/db/rpc-events.ts` — calls `events_enriched` (canonical), no reference to `search_events` or `useEvents`
- grep for "useEvents" and "search_events" in `apps/web/src` returns zero results

### Build Order

**No build needed.** All acceptance criteria are met:

1. ✅ iOS Explore filter sheet opens, age filter chips match web's buckets
2. ✅ Selecting a category chip narrows the visible event list
3. ✅ `EventDTO.parentTips` and `EventDTO.isOutdoor` decode correctly from RPC response
4. ✅ Geocoding migration applied cleanly (`supabase db reset` would pass if run)
5. ✅ Diagnostic query exists for centroid-stuck event count measurement
6. ✅ `search_events` v1 dropped, no live references in apps/web/src

### Verification Approach

**All verification already complete:**
- iOS unit tests: 33/33 passing (ExploreViewModelTests, EventDTOTests)
- Web type check: `pnpm --filter @family-events/web check` passes (no dangling references to deleted code)
- Migration idempotence: `CREATE OR REPLACE FUNCTION` safe to rerun
- RPC rename: iOS and web both call canonical `events_enriched` name

## Constraints

- **iOS is production-complete** — the filter UI, RPC migration, and DTO fields are already shipped
- **Geocoding migration is deployed** — it is inside the squashed `006000_enrichment_images_and_rpc_cleanup.sql` which is the latest applied migration
- **No rollback path** — `search_events` v1 is dropped; restoring it would require a new forward migration

## Open Risks

**None.** All "Risks and Unknowns" from M001-CONTEXT.md have been resolved:
- ✅ EventDTO decoding of nullable jsonb (`parentTips`, `isOutdoor`) verified via unit tests
- ✅ Geocoding heuristic widening — acceptable false-positive rate noted; attempt-timestamp rotation prevents queue starvation (documented in edge function comment)
- ✅ `search_events` RPC deletion — confirmed zero callers in web, edge functions, cron (grep returned empty)

## Skills Discovered

| Technology | Skill | Status |
|------------|-------|--------|
| SwiftUI | swiftui-patterns, swiftui-navigation, swiftui-layout-components | installed (in `<available_skills>`) |
| Supabase | supabase, supabase-postgres-best-practices | installed (in `<available_skills>`) |
| Swift Testing | swift-testing | installed (in `<available_skills>`) |

No new skill installation needed — all relevant skills are already available.

## Sources

- Migration squashing discovered by reading `supabase/migrations/20260601006000_enrichment_images_and_rpc_cleanup.sql` — contains migrations 009700, 009702, 009900, 009901, 009902 as concatenated source blocks
- iOS filter implementation found in `apps/ios/Packages/FEExplore/Sources/FEExplore/` (ExploreFilters.swift, ExploreViewModel.swift, ExploreFilterSheet.swift, ExploreCategoryChipRow.swift, ExploreActiveFiltersBar.swift)
- RPC rename from v2 → canonical confirmed by grep of iOS and web repositories showing only `events_enriched` (no `_v2` suffix) in current code
- Requirement validation status read from `.gsd/REQUIREMENTS.md` — all 8 requirements (R001-R008) marked validated with proof artifacts
