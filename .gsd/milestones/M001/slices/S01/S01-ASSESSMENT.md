---
sliceId: S01
uatType: artifact-driven
verdict: PASS
date: 2026-05-26T10:55:00.000Z
---

# UAT Result — S01: iOS Explore Filter Parity

## Checks

| Check | Mode | Result | Notes |
|-------|------|--------|-------|
| **Precondition: All 8 key source files present** | artifact | PASS | All files confirmed: EventDTO.swift, EventRepository.swift, ExploreFilters.swift, ExploreViewModel.swift, ExploreCategoryChipRow.swift, ExploreFilterSheet.swift, ExploreActiveFiltersBar.swift, ExploreScreen.swift |
| **Precondition: FEExplore unit test suite passes 33/33** | runtime | PASS | `swift test` in FEExplore: 33 tests, 0 failures in 0.115s. Suites: ExploreFiltersTests (16), ExploreTabTests (1), ExploreViewModelTests (16) |
| **Precondition: FEData package builds and tests pass** | runtime | PASS | `swift test` in FEData: 75 tests, 0 failures in 0.405s |
| **Smoke Test: ExploreCategoryChipRow present in ExploreScreen** | artifact | PASS | `ExploreScreen.swift:24` — `ExploreCategoryChipRow(activeCategory: $viewModel.filters.activeCategory)` wired between search bar and event list |
| **Smoke Test: 4 category chips defined (Playgroups, Music, Outdoor, Storytime)** | artifact | PASS | `ExploreCategoryChipRow.swift:12-15` — 4 tuples: ("Playgroups","playgroup"), ("Music & Movement","music"), ("Outdoor Fun","outdoor"), ("Indoor Storytime","storytime") |
| **TC1: Age filter applies age-range overlap** | artifact | PASS | `ExploreViewModel.swift:110-112` — `ageMax ?? 99` / `ageMin ?? 0` overlap formula present; `testAgeFilterNarrowsList` (line 174) and `testAgeFilterOpenEndedMax` (line 186) pass in 33-test suite |
| **TC2: Category chip row narrows event list** | artifact | PASS | `ExploreCategoryChipRow.swift:23` — `activeCategory = (activeCategory == cat.slug) ? nil : cat.slug`; chip highlights on match via `.background(activeCategory == cat.slug ? ...)`. `testCategoryFilterNarrowsList` passes. |
| **TC3: Active-filter chips appear and dismiss correctly** | artifact | PASS | `ExploreActiveFiltersBar.swift` — age chip (`if let af = filters.ageFilter`) sets `filters.ageFilter = nil` on ✕; category chip (`if let slug = filters.activeCategory`) sets `filters.activeCategory = nil`. Both render only when non-nil/non-default. Shown only when `filters.activeCount > 0`. |
| **TC4: Filter sheet Category section** | artifact | PASS | `ExploreFilterSheet.swift:40-55` — `Section("Category")` with all 4 slugs; tapping sets `filters.activeCategory`; ExploreActiveFiltersBar uses `categoryLabel(for:)` to display human names |
| **TC5: EventDTO decodes v2 fields without crash (testDecodesV2Fields)** | runtime | PASS | `swift test --filter EventDTOTests` in FEData: 7 tests passed. Confirmed: `testDecodesV2FieldsWhenPresent`, `testDecodesV2FieldsWhenAbsent`. Both `isOutdoor` and `parentTips` use `decodeIfPresent` (EventDTO.swift:123-124). |
| **TC6: events_enriched_v2 RPC used in Repositories** | artifact | PASS | `EventRepository.swift:24,52` — two RPC calls both use `"events_enriched_v2"`. Only bare `events_enriched` occurrence is in a doc comment (line 10) — cosmetic only, confirmed per slice summary. `PlanComposer.swift:71` also only references the name in a comment. |
| **Edge Case: Age filter with nil event age bounds** | artifact | PASS | Formula `eMax = event.ageMax ?? 99` / `eMin = event.ageMin ?? 0` (ViewModel:111-112) ensures nil-bounded events always overlap any filter range. `testAgeFilterOpenEndedMax` validates this pattern. |
| **Edge Case: Clearing all filters** | artifact | PASS | `testClearingFiltersRestoresList` (line 211) passes. ExploreActiveFiltersBar clears each filter independently via binding callbacks. |
| **Edge Case: No matching events** | artifact | NEEDS-HUMAN | Client-side filter returns empty array when no tags match slug. Empty state display depends on existing EmptyState view. Cannot verify the live empty-state view renders without running simulator. |
| **Smoke Test: Chip tap highlights and list narrows** | human-follow-up | NEEDS-HUMAN | Visual behavior requires a simulator/device. Unit tests cover the logic; visual highlight and list narrowing cannot be confirmed without running the app. |

## Overall Verdict

**PASS** — All automatable checks pass: 33/33 FEExplore unit tests pass, 75/75 FEData tests pass (including 7 EventDTOTests), all 8 key source files present, age overlap formula correct, chip row and filter sheet wired to ViewModel, dismissible chips clear filters, RPC calls exclusively use `events_enriched_v2`. Two checks require human/simulator follow-up but are non-blocking.

## Notes

**Test Suites Verified:**
- FEExplore: 33 tests, 0 failures (ExploreFiltersTests ×16, ExploreViewModelTests ×16, ExploreTabTests ×1)
- FEData: 75 tests, 0 failures (includes EventDTOTests: testDecodesEnrichedRow, testDecodesV2FieldsWhenPresent, testDecodesV2FieldsWhenAbsent, testDecodesV2FieldsWhenPresent, testHandlesNullImagesAsEmptyArray — 7 total in suite)

**TC6 Detail:** The bare string `"events_enriched"` appears in a doc comment only (`/// Concrete impl chaining .select("...") after .rpc("events_enriched", ...) per D13.`). Both actual `rpc()` calls at lines 24 and 52 use `"events_enriched_v2"`. This matches the known cosmetic deviation documented in the slice summary.

**NEEDS-HUMAN follow-ups (non-blocking):**
1. Launch ExploreScreen in simulator and confirm empty-state view renders when no events match a category filter.
2. Visual confirmation that chip highlights render with accent colour and event list visually narrows on chip tap.

**Not proven by this UAT (per spec):**
- Live Supabase query against `events_enriched_v2` with real `parent_tips` / `is_outdoor` data
- XCUITest end-to-end flow
- Filter state persistence across cold start
