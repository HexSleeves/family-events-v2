---
estimated_steps: 22
estimated_files: 4
skills_used: []
---

# T02: Added AgeFilter enum (5 buckets) + activeCategory to ExploreFilters; extended applyClientFilters with age-range overlap and category slug checks; 33/33 tests pass.

**Why**: ExploreFilters has no age or category support. applyClientFilters in ExploreViewModel only checks onlyFree and keyword. Adding the AgeFilter enum (5 buckets matching web's EXPLORE_AGE_OPTIONS) and activeCategory (single-select tag slug) completes the model/logic layer for R001 and R002, and closes the filter logic before any UI is wired.

**Do**:
1. In ExploreFilters.swift: Add `AgeFilter` enum as a public, String-backed, CaseIterable, Equatable, Sendable enum with 5 cases:
   - `zeroToOne = "0–1 yr"`, `oneToThree = "1–3 yrs"`, `twoToFour = "2–4 yrs"`, `fiveToEight = "5–8 yrs"`, `nineAndUp = "9+ yrs"`
   - Add computed vars `var min: Int` (0,1,2,5,9 respectively) and `var max: Int?` (1,3,4,8,nil respectively — nineAndUp has nil for open-ended).
2. Add `public var ageFilter: AgeFilter? = nil` and `public var activeCategory: String? = nil` to ExploreFilters struct.
3. Update `activeCount`: add `if ageFilter != nil { n += 1 }` and `if activeCategory != nil { n += 1 }`.
4. Update `init` to accept `ageFilter: AgeFilter? = nil, activeCategory: String? = nil` with defaults; assign both.
5. In ExploreViewModel.swift: Extend `applyClientFilters` filter closure with:
   - Age logic (after existing onlyFree check): `if let af = filters.ageFilter { let eMax = event.ageMax ?? 99; let eMin = event.ageMin ?? 0; let fMax = af.max ?? Int.max; if eMax < af.min || eMin > fMax { return false } }`
   - Category logic: `if let slug = filters.activeCategory { if !event.tags.contains(where: { $0.slug == slug }) { return false } }`
6. In ExploreFiltersTests.swift: Add:
   - `testAgeFilterIncrementsActiveCount` — set ageFilter = .zeroToOne → activeCount == 1
   - `testActiveCategoryIncrementsActiveCount` — set activeCategory = "playgroup" → activeCount == 1
   - `testAllFiveFiltersActiveCount` — set keyword + dateFilter + onlyFree + ageFilter + activeCategory → activeCount == 5
   - `testAgeFilterBucketValues` — verify each case's min/max (e.g. nineAndUp.min == 9, nineAndUp.max == nil; zeroToOne.min == 0, zeroToOne.max == 1)
7. In ExploreViewModelTests.swift: Add:
   - `testAgeFilterNarrowsList` — repo returns two events (ageMax:1 and ageMax:10); set filters.ageFilter = .zeroToOne; reload → only the ageMax:1 event passes
   - `testAgeFilterOpenEndedMax` — event with ageMax:nil (treated as 99); filter = .nineAndUp (min:9, max:nil → fMax:Int.max) → event passes (99 >= 9)
   - `testCategoryFilterNarrowsList` — two events: one with tag slug "playgroup", one with tag slug "music"; set filters.activeCategory = "playgroup" → only the playgroup event passes
   - `testClearingFiltersRestoresList` — set ageFilter, observe narrowed list, set ageFilter = nil, observe full list returns

**Done when**: ExploreFilters.swift contains AgeFilter enum with 5 cases; ExploreViewModel.applyClientFilters checks ageFilter and activeCategory; new tests exist in both test files.

## Inputs

- `apps/ios/Packages/FEExplore/Sources/FEExplore/ViewModels/ExploreFilters.swift`
- `apps/ios/Packages/FEExplore/Sources/FEExplore/ViewModels/ExploreViewModel.swift`
- `apps/ios/Packages/FEExplore/Tests/FEExploreTests/ExploreFiltersTests.swift`
- `apps/ios/Packages/FEExplore/Tests/FEExploreTests/ExploreViewModelTests.swift`
- `apps/ios/Packages/FEData/Sources/FEData/DTOs/EventDTO.swift`
- `apps/web/src/features/explore/constants/categories.ts`
- `apps/web/src/features/events/lib/event-filters.ts`

## Expected Output

- `apps/ios/Packages/FEExplore/Sources/FEExplore/ViewModels/ExploreFilters.swift`
- `apps/ios/Packages/FEExplore/Sources/FEExplore/ViewModels/ExploreViewModel.swift`
- `apps/ios/Packages/FEExplore/Tests/FEExploreTests/ExploreFiltersTests.swift`
- `apps/ios/Packages/FEExplore/Tests/FEExploreTests/ExploreViewModelTests.swift`

## Verification

grep -q "AgeFilter" apps/ios/Packages/FEExplore/Sources/FEExplore/ViewModels/ExploreFilters.swift && grep -q "activeCategory" apps/ios/Packages/FEExplore/Sources/FEExplore/ViewModels/ExploreFilters.swift && grep -q "ageFilter" apps/ios/Packages/FEExplore/Sources/FEExplore/ViewModels/ExploreViewModel.swift
