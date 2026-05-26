---
id: S01
parent: M001
milestone: M001
provides:
  - EventDTO with isOutdoor and parentTips v2 fields (FEData)
  - SupabaseEventRepository calling events_enriched_v2 for both fetch paths
  - ExploreFilters with AgeFilter enum (5 buckets) and activeCategory
  - applyClientFilters with age-overlap and category-slug logic
  - ExploreCategoryChipRow (4 chips), updated ExploreFilterSheet (Age+Category sections), updated ExploreActiveFiltersBar (dismissible chips)
  - 33/33 FEExplore unit tests green
requires:
  []
affects:
  - S03
key_files:
  - apps/ios/Packages/FEData/Sources/FEData/DTOs/EventDTO.swift
  - apps/ios/Packages/FEData/Sources/FEData/Repositories/EventRepository.swift
  - apps/ios/Packages/FEExplore/Sources/FEExplore/ViewModels/ExploreFilters.swift
  - apps/ios/Packages/FEExplore/Sources/FEExplore/ViewModels/ExploreViewModel.swift
  - apps/ios/Packages/FEExplore/Sources/FEExplore/Components/ExploreCategoryChipRow.swift
  - apps/ios/Packages/FEExplore/Sources/FEExplore/Components/ExploreFilterSheet.swift
  - apps/ios/Packages/FEExplore/Sources/FEExplore/Components/ExploreActiveFiltersBar.swift
  - apps/ios/Packages/FEExplore/Sources/FEExplore/Screens/ExploreScreen.swift
key_decisions:
  - Used decodeIfPresent (not decode) for isOutdoor and parentTips in EventDTO — prevents crash when v2 fields are absent from older records
  - AgeFilter enum uses nil max for nineAndUp bucket; filter logic substitutes Int.max for unbounded upper range
  - Age overlap check uses event.ageMax ?? 99 and event.ageMin ?? 0 to handle nil age fields gracefully
  - activeCategory is a single-select String? (category slug) — matches web's single-active-category behaviour
  - categoryLabel(for:) helper centralised in ExploreActiveFiltersBar for slug-to-display-name mapping
  - Used dsAccentPrimarySoft/dsAccentPrimary FEDesignSystem colors for selected chip state in ExploreCategoryChipRow
patterns_established:
  - iOS optional v2 fields: use decodeIfPresent for any new RPC field that may be absent on legacy records
  - Age range overlap: (event.ageMax ?? 99) >= filter.min && (event.ageMin ?? 0) <= (filter.max ?? Int.max)
  - Client-side filter composition: add filter field to ExploreFilters, increment activeCount, apply in applyClientFilters, surface chip in ExploreActiveFiltersBar
observability_surfaces:
  - RPC name change (v1→v2) visible in Supabase query logs and Xcode network instruments — no new logging added (filter logic is synchronous client-side)
drill_down_paths:
  - .gsd/milestones/M001/slices/S01/tasks/T01-SUMMARY.md
  - .gsd/milestones/M001/slices/S01/tasks/T02-SUMMARY.md
  - .gsd/milestones/M001/slices/S01/tasks/T03-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-05-26T16:47:34.117Z
blocker_discovered: false
---

# S01: iOS Explore Filter Parity

**iOS Explore now has age-bucket and category filters matching web: 4 inline category chips, a filter sheet with Age and Category sections, dismissible active-filter chips, and EventDTO upgraded to decode v2 fields (isOutdoor, parentTips) from events_enriched_v2.**

## What Happened

S01 shipped across three tightly-sequenced tasks that worked bottom-up: data layer first, then logic, then UI.

**T01 — Data layer upgrade (FEData):** EventDTO gained `isOutdoor: Bool?` and `parentTips: [ParentTip]?` decoded with `decodeIfPresent`, preventing crash when v2 fields are absent from older records. A new `ParentTip` struct was added. Both RPC call sites in `SupabaseEventRepository` (`fetch(ids:)` and `fetchList(query:for:)`) were migrated from `events_enriched_v2` (verified: 2 occurrences). Two unit tests — `testDecodesV2FieldsPresent` and `testDecodesV2FieldsAbsent` — were added to `EventDTOTests.swift`, covering both populated and nil code paths.

**T02 — Filter model + logic (FEExplore):** `ExploreFilters` gained an `AgeFilter` enum with 5 buckets (`zeroToOne`, `oneToThree`, `twoToFour`, `fiveToEight`, `nineAndUp`) matching web's `EXPLORE_AGE_OPTIONS`, plus an `activeCategory: String?` field for single-select category slug. `activeCount` was extended to include both new fields. `applyClientFilters` in `ExploreViewModel` was updated with age-range overlap logic (`event.ageMax ?? 99 >= filter.min && event.ageMin ?? 0 <= filter.max ?? Int.max`) and category slug match. All 33 FEExplore tests pass.

**T03 — UI surfaces (FEExplore):** Three visual components were created or extended. `ExploreCategoryChipRow.swift` was created with 4 category chips (Playgroups, Music, Outdoor, Storytime) using `dsAccentPrimarySoft`/`dsAccentPrimary` for selected state. `ExploreFilterSheet` received Age (picker) and Category (checkmark list) sections bound to `filters.ageFilter` and `filters.activeCategory`. `ExploreActiveFiltersBar` gained dismissible chips for age and category, with a `categoryLabel(for:)` helper centralising slug-to-display-name mapping. `ExploreScreen` was updated to insert `ExploreCategoryChipRow` between the search bar and the active filters bar.

## Verification

All 9 slice-level verification checks passed (exit 0):
- T01: `events_enriched_v2` present in EventRepository.swift (2 occurrences — both RPC call sites); `parentTips` and `isOutdoor` present in EventDTO.swift; `decodeIfPresent` used for both v2 fields; `testDecodesV2Fields` present in EventDTOTests.swift.
- T02: `AgeFilter` and `activeCategory` present in ExploreFilters.swift; `ageFilter` present in ExploreViewModel.swift; 33/33 FEExplore tests pass (verified in T02 task summary, swift test exit 0).
- T03: `ExploreCategoryChipRow.swift` exists; `ExploreCategoryChipRow` wired into ExploreScreen.swift; `ageFilter` and `activeCategory` present in ExploreActiveFiltersBar.swift; `activeCategory` and age filter sections present in ExploreFilterSheet.swift.
Proof level: contract (unit tests) + grep/file existence. Runtime/visual confirmation deferred to UAT.

## Requirements Advanced

- R001 — AgeFilter enum with 5 buckets added to ExploreFilters; applyClientFilters applies age-range overlap; dismissible chip in ExploreActiveFiltersBar; 33/33 tests pass
- R002 — activeCategory field added to ExploreFilters; ExploreFilterSheet has Category section; slug match applied in applyClientFilters; dismissible category chip in ExploreActiveFiltersBar
- R003 — ExploreCategoryChipRow.swift created with 4 category chips; wired into ExploreScreen between search bar and active filters bar
- R008 — Both RPC call sites in SupabaseEventRepository use events_enriched_v2; EventDTO includes parentTips (ParentTip struct) and isOutdoor via decodeIfPresent; unit tests cover v2 fields present and absent

## Requirements Validated

- R001 — AgeFilter enum with 5 buckets in ExploreFilters.swift (grep PASS); ageFilter applied in ExploreViewModel.swift (grep PASS); ageFilter chip in ExploreActiveFiltersBar.swift (grep PASS); 33/33 FEExplore tests pass
- R002 — activeCategory in ExploreFilters.swift (grep PASS); Category section in ExploreFilterSheet.swift (grep PASS); activeCategory chip in ExploreActiveFiltersBar.swift (grep PASS)
- R003 — ExploreCategoryChipRow.swift exists (file test PASS); ExploreCategoryChipRow wired in ExploreScreen.swift (grep PASS)
- R008 — events_enriched_v2 appears 2× in EventRepository.swift (both RPC sites); parentTips and isOutdoor with decodeIfPresent in EventDTO.swift (grep PASS); testDecodesV2Fields in EventDTOTests.swift (grep PASS)

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Operational Readiness

None.

## Deviations

None.

## Known Limitations

Runtime/visual confirmation (chip tap narrowing event list in a running simulator) is deferred to UAT — filter logic is synchronous client-side and is unit-tested, but no UI snapshot or integration test was run. Category selection is single-select only (matches web's current behaviour); multi-select is not implemented.

## Follow-ups

None.

## Files Created/Modified

- `apps/ios/Packages/FEData/Sources/FEData/DTOs/EventDTO.swift` — Added ParentTip struct; added isOutdoor: Bool? and parentTips: [ParentTip]? fields decoded with decodeIfPresent
- `apps/ios/Packages/FEData/Sources/FEData/Repositories/EventRepository.swift` — Migrated both RPC call sites (fetch(ids:) and fetchList(query:for:)) from events_enriched_v1 to events_enriched_v2
- `apps/ios/Packages/FEData/Tests/FEDataTests/DTOs/EventDTOTests.swift` — Added testDecodesV2FieldsPresent and testDecodesV2FieldsAbsent unit tests covering v2 fields present and absent
- `apps/ios/Packages/FEExplore/Sources/FEExplore/ViewModels/ExploreFilters.swift` — Added AgeFilter enum (5 buckets: zeroToOne, oneToThree, twoToFour, fiveToEight, nineAndUp) and activeCategory: String? field; extended activeCount
- `apps/ios/Packages/FEExplore/Sources/FEExplore/ViewModels/ExploreViewModel.swift` — Extended applyClientFilters with age-range overlap check and category slug match using new ExploreFilters fields
- `apps/ios/Packages/FEExplore/Tests/FEExploreTests/ExploreFiltersTests.swift` — Added tests for AgeFilter enum buckets and activeCategory field
- `apps/ios/Packages/FEExplore/Tests/FEExploreTests/ExploreViewModelTests.swift` — Extended tests for age-overlap and category filter logic; 33/33 tests pass
- `apps/ios/Packages/FEExplore/Sources/FEExplore/Components/ExploreCategoryChipRow.swift` — Created new component with 4 category chips (Playgroups, Music, Outdoor, Storytime) using dsAccentPrimary color for selected state
- `apps/ios/Packages/FEExplore/Sources/FEExplore/Components/ExploreFilterSheet.swift` — Added Age (picker, 5 buckets + Any) and Category (checkmark list, 4 items) sections to the filter sheet
- `apps/ios/Packages/FEExplore/Sources/FEExplore/Components/ExploreActiveFiltersBar.swift` — Added dismissible chips for ageFilter and activeCategory; added categoryLabel(for:) helper for slug-to-display-name mapping
- `apps/ios/Packages/FEExplore/Sources/FEExplore/Screens/ExploreScreen.swift` — Wired ExploreCategoryChipRow between search bar and active filters bar
