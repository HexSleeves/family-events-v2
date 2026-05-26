# S01: iOS Explore Filter Parity

**Goal:** iOS Explore reaches filter parity with web: 4 category chips inline, filter sheet has Age and Category sections, selecting '0–1 yr' narrows the event list, active filters show dismissible chips, and EventDTO decodes v2 fields (isOutdoor, parentTips) without crash while SupabaseEventRepository calls events_enriched_v2.
**Demo:** iOS Explore shows 4 category chips inline, filter sheet has Age and Category sections, selecting '0-1yr' narrows the event list, active filters show dismissible chips — and EventDTO decodes v2 fields without crash.

## Must-Haves

- EventDTO has isOutdoor: Bool? and parentTips: [ParentTip]? decoded with decodeIfPresent; nil and populated cases both pass unit tests
- EventRepository calls events_enriched_v2 for both fetch(ids:) and fetchList(query:for:)
- ExploreFilters has AgeFilter enum (5 buckets matching web) and activeCategory: String?; activeCount includes both
- applyClientFilters in ExploreViewModel applies age-range overlap (event.ageMax ?? 99 >= filter.min && event.ageMin ?? 0 <= filter.max ?? Int.max) and category slug match
- ExploreScreen shows ExploreCategoryChipRow between search bar and active filters bar
- ExploreFilterSheet has Age (picker) and Category (checkmark list) sections
- ExploreActiveFiltersBar emits dismissible chips for ageFilter and activeCategory

## Proof Level

- This slice proves: contract — unit tests verify decode correctness and filter logic; UI wiring verified by grep/file existence; runtime/visual confirmation is UAT

## Integration Closure

Upstream: FEData (EventDTO, EventRepository) feeds FEExplore (ExploreViewModel, UI). New wiring: ExploreCategoryChipRow binds to viewModel.filters.activeCategory; ExploreFilterSheet binds to filters.ageFilter and filters.activeCategory; ExploreActiveFiltersBar reads both new filter fields. What remains before milestone end-to-end: S02 (geocoding) and S03 (dead code removal) are independent — S01 is self-contained.

## Verification

- None at runtime — all filter logic is synchronous client-side. RPC name change (v1→v2) is visible in Supabase logs and Xcode network instruments. No new logging introduced.

## Tasks

- [x] **T01: Added ParentTip struct + isOutdoor/parentTips fields to EventDTO (decodeIfPresent), migrated both SupabaseEventRepository RPC calls to events_enriched_v2, and added two unit tests covering v2 fields present and absent.** `est:45m`
  **Why**: iOS EventDTO is missing isOutdoor and parentTips fields that events_enriched_v2 returns. SupabaseEventRepository still calls the deprecated v1 RPC. Migrating is required for R008 and is the highest-risk task (decode crash if parentTips is mis-typed). Do this first so T02/T03 can use the updated fixture shape.
  - Files: `apps/ios/Packages/FEData/Sources/FEData/DTOs/EventDTO.swift`, `apps/ios/Packages/FEData/Sources/FEData/Repositories/EventRepository.swift`, `apps/ios/Packages/FEData/Tests/FEDataTests/DTOs/EventDTOTests.swift`
  - Verify: grep -q "events_enriched_v2" apps/ios/Packages/FEData/Sources/FEData/Repositories/EventRepository.swift && grep -q "parentTips" apps/ios/Packages/FEData/Sources/FEData/DTOs/EventDTO.swift && grep -q "testDecodesV2Fields" apps/ios/Packages/FEData/Tests/FEDataTests/DTOs/EventDTOTests.swift

- [x] **T02: Added AgeFilter enum (5 buckets) + activeCategory to ExploreFilters; extended applyClientFilters with age-range overlap and category slug checks; 33/33 tests pass.** `est:45m`
  **Why**: ExploreFilters has no age or category support. applyClientFilters in ExploreViewModel only checks onlyFree and keyword. Adding the AgeFilter enum (5 buckets matching web's EXPLORE_AGE_OPTIONS) and activeCategory (single-select tag slug) completes the model/logic layer for R001 and R002, and closes the filter logic before any UI is wired.
  - Files: `apps/ios/Packages/FEExplore/Sources/FEExplore/ViewModels/ExploreFilters.swift`, `apps/ios/Packages/FEExplore/Sources/FEExplore/ViewModels/ExploreViewModel.swift`, `apps/ios/Packages/FEExplore/Tests/FEExploreTests/ExploreFiltersTests.swift`, `apps/ios/Packages/FEExplore/Tests/FEExploreTests/ExploreViewModelTests.swift`
  - Verify: grep -q "AgeFilter" apps/ios/Packages/FEExplore/Sources/FEExplore/ViewModels/ExploreFilters.swift && grep -q "activeCategory" apps/ios/Packages/FEExplore/Sources/FEExplore/ViewModels/ExploreFilters.swift && grep -q "ageFilter" apps/ios/Packages/FEExplore/Sources/FEExplore/ViewModels/ExploreViewModel.swift

- [x] **T03: Created ExploreCategoryChipRow (4 category chips), added Age/Category sections to ExploreFilterSheet, added ageFilter/activeCategory dismissible chips to ExploreActiveFiltersBar, and wired ExploreCategoryChipRow into ExploreScreen between search bar and active filters bar.** `est:60m`
  **Why**: With the model (T01) and filter logic (T02) in place, this task closes R001/R002/R003 by wiring three visual surfaces: the inline category chip row (quick one-tap filter), the Age and Category sections in the filter sheet (full filter controls), and the dismissible chips in ExploreActiveFiltersBar (active filter state). All changes are additive — no existing sections are modified.
  - Files: `apps/ios/Packages/FEExplore/Sources/FEExplore/Components/ExploreCategoryChipRow.swift`, `apps/ios/Packages/FEExplore/Sources/FEExplore/Components/ExploreFilterSheet.swift`, `apps/ios/Packages/FEExplore/Sources/FEExplore/Components/ExploreActiveFiltersBar.swift`, `apps/ios/Packages/FEExplore/Sources/FEExplore/Screens/ExploreScreen.swift`
  - Verify: test -f apps/ios/Packages/FEExplore/Sources/FEExplore/Components/ExploreCategoryChipRow.swift && grep -q "ExploreCategoryChipRow" apps/ios/Packages/FEExplore/Sources/FEExplore/Screens/ExploreScreen.swift && grep -q "ageFilter" apps/ios/Packages/FEExplore/Sources/FEExplore/Components/ExploreActiveFiltersBar.swift

## Files Likely Touched

- apps/ios/Packages/FEData/Sources/FEData/DTOs/EventDTO.swift
- apps/ios/Packages/FEData/Sources/FEData/Repositories/EventRepository.swift
- apps/ios/Packages/FEData/Tests/FEDataTests/DTOs/EventDTOTests.swift
- apps/ios/Packages/FEExplore/Sources/FEExplore/ViewModels/ExploreFilters.swift
- apps/ios/Packages/FEExplore/Sources/FEExplore/ViewModels/ExploreViewModel.swift
- apps/ios/Packages/FEExplore/Tests/FEExploreTests/ExploreFiltersTests.swift
- apps/ios/Packages/FEExplore/Tests/FEExploreTests/ExploreViewModelTests.swift
- apps/ios/Packages/FEExplore/Sources/FEExplore/Components/ExploreCategoryChipRow.swift
- apps/ios/Packages/FEExplore/Sources/FEExplore/Components/ExploreFilterSheet.swift
- apps/ios/Packages/FEExplore/Sources/FEExplore/Components/ExploreActiveFiltersBar.swift
- apps/ios/Packages/FEExplore/Sources/FEExplore/Screens/ExploreScreen.swift
