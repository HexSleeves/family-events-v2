# S01: iOS Explore Filter Parity — Research

**Date:** 2026-05-26

## Summary

The iOS Explore screen currently has `ExploreFilters` with three fields: `keyword`, `dateFilter` (enum), and `onlyFree` — no age, tag, or category support whatsoever. `ExploreViewModel.applyClientFilters` only checks `onlyFree` and keyword. `ExploreFilterSheet` shows only Date and Price sections. `ExploreActiveFiltersBar` renders chips only for keyword, date, and free. The data layer is complete: `EventDTO` already has `ageMin`/`ageMax` as optional `Int` fields, and `tags: [TagDTO]` with each tag having a `slug` field — so tag-based filtering is a pure client-side exercise with zero data changes needed.

The `SupabaseEventRepository` (`EventRepository.swift`) currently calls `events_enriched` (v1) for both `fetch()` and `fetchList()`. The v2 RPC signature is a superset: same params plus cursor-pagination params (`p_after_start_datetime`, `p_after_id`). The v2 return type adds `is_outdoor` (boolean), `parent_tips` (jsonb — array of objects with `category` and `text` string fields, 1-3 elements, nullable), `parent_tips_generated_at`, `recurrence_info`, `search_vector`, `is_in_calendar`, and `image_attributions`. EventDTO needs `isOutdoor: Bool?` and `parentTips: [[String: String]]?` (or a typed struct) added, plus the v2 cursor fields need to be surfaced if cursor pagination is desired.

The web categories source of truth (`categories.ts`) defines 4 chips: Playgroups (`playgroup`), Music & Movement (`music`), Outdoor Fun (`outdoor`), Indoor Storytime (`storytime`) — plus 5 age buckets matching R001. The web `matchesAgeFilter` logic is trivial: open-ended max defaults to 99, check `event.ageMax >= filterMin && event.ageMin <= filterMax`. This ports directly to Swift.

## Recommendation

**Three parallel work units, in this order:**

1. **EventDTO + EventRepository v2 migration** (highest risk — decode crash risk, foundation for everything else): Add `isOutdoor: Bool?` and `parentTips: [[String: String]]?` to EventDTO with `decodeIfPresent`. Switch `SupabaseEventRepository.fetchList` to call `events_enriched_v2`. Add `parent_tips` and `is_outdoor` to the `eventColumns` select string. Add cursor params to `EventQuery` (optional, for pagination). Write a decode test covering nil `parent_tips` and nil `is_outdoor`.

2. **ExploreFilters + ExploreViewModel filter logic**: Add `ageFilter: AgeFilter?` (enum with 5 cases matching web) and `activeCategory: String?` (tag slug) to `ExploreFilters` — keep it `Equatable` and `Sendable`. Extend `activeCount` to include these. Add `applyClientFilters` age logic (port of `matchesAgeFilter`) and tag slug matching (`event.tags.contains { $0.slug == activeCategory }`). Write unit tests for boundary cases.

3. **UI components** (ExploreFilterSheet Age + Tags sections, ExploreScreen category chip row, ExploreActiveFiltersBar age + category chips): These are additive — do not modify existing sections, only append. Use the same `chip()` pattern already in ExploreActiveFiltersBar. Inline chip row goes between `ExploreSearchBar` and `ExploreActiveFiltersBar` in `ExploreScreen`.

## Implementation Landscape

### Key Files

- `apps/ios/Packages/FEData/Sources/FEData/DTOs/EventDTO.swift` — Add `isOutdoor: Bool?` and `parentTips: [[String: String]]?`; add `CodingKeys` cases; update `init(from:)` with `decodeIfPresent`; update memberwise `init`. Currently decode-only, encode throws — keep that pattern.
- `apps/ios/Packages/FEData/Sources/FEData/Repositories/EventRepository.swift` — Switch `fetchList` and `fetch` from `events_enriched` to `events_enriched_v2`; add `is_outdoor` and `parent_tips` to `eventColumns`; no param changes needed for basic parity (cursor params optional).
- `apps/ios/Packages/FEData/Sources/FEData/DTOs/EventQuery.swift` — Optionally add `afterStartDatetime: Date?` and `afterID: String?` for cursor pagination. Low priority for this slice.
- `apps/ios/Packages/FEExplore/Sources/FEExplore/ViewModels/ExploreFilters.swift` — Add `AgeFilter` enum (5 cases with `min`/`max` computed vars), `ageFilter: AgeFilter? = nil`, `activeCategory: String? = nil`; extend `activeCount`; keep `Equatable` and `Sendable`.
- `apps/ios/Packages/FEExplore/Sources/FEExplore/ViewModels/ExploreViewModel.swift` — Extend `applyClientFilters` to apply age bucket (check `event.ageMax ?? 99 >= filter.min && event.ageMin ?? 0 <= filter.max`) and category slug match.
- `apps/ios/Packages/FEExplore/Sources/FEExplore/Components/ExploreFilterSheet.swift` — Add `Section("Age")` with Picker/toggle group for 5 age buckets; add `Section("Category")` with tag chip multi-select or single-select. Binding to `$filters.ageFilter` and `$filters.activeCategory`.
- `apps/ios/Packages/FEExplore/Sources/FEExplore/Components/ExploreActiveFiltersBar.swift` — Add chip emissions for `filters.ageFilter` and `filters.activeCategory` using the existing `chip()` helper.
- `apps/ios/Packages/FEExplore/Sources/FEExplore/Screens/ExploreScreen.swift` — Add inline `ExploreCategoryChipRow` between `ExploreSearchBar` and `ExploreActiveFiltersBar`. This is a new component (create in Components/).
- `apps/web/src/features/explore/constants/categories.ts` — Read-only reference. Category slugs: `playgroup`, `music`, `outdoor`, `storytime`. Labels: "Playgroups", "Music & Movement", "Outdoor Fun", "Indoor Storytime".
- `apps/web/src/features/events/lib/event-filters.ts` — Read-only reference. `matchesAgeFilter` logic to port.

### Build Order

1. **EventDTO + EventRepository first** — this is the highest-risk item (decode crash if `parent_tips` is mis-typed) and all UI work builds on a working data layer. Verify with a unit test decoding a mock v2 JSON response with nil fields. This also unblocks confirming the RPC call compiles.
2. **ExploreFilters + ExploreViewModel** — pure model/logic work. Write unit tests for age bucket boundary cases and tag slug matching. No UI dependency.
3. **UI components last** — ExploreFilterSheet additions, ExploreCategoryChipRow (new file), ExploreActiveFiltersBar extensions. These are the most visual and easiest to verify manually.

### Verification Approach

- `xcodebuild test -scheme FEData -destination ...` — EventDTO decode test with nil `parent_tips`/`is_outdoor`, and a test with populated parent_tips array.
- `xcodebuild test -scheme FEExplore -destination ...` — ExploreViewModel unit tests: age filter 0-1yr returns only events where ageMax ≥ 0 && ageMin ≤ 1; `activeCategory = "playgroup"` returns only events with that slug; combined filter.
- Visual: Run app, open Explore, select age bucket, confirm list narrows. Open filter sheet, verify Age and Category sections appear. Select category chip inline, confirm active filter chip appears.
- Supabase logs or Xcode network instruments: confirm `events_enriched_v2` RPC is called (not v1).

## Constraints

- `ExploreFilters` must remain `Equatable` and `Sendable` — `AgeFilter` enum and `String?` activeCategory both satisfy this automatically.
- iOS feature packages (`FEExplore`, `FEData`) must not import Supabase directly — the `SupabaseEventRepository` is in `FEData` which already imports Supabase correctly. `FEExplore` only imports `FEData` and `FECore` protocols.
- `EventDTO` is decode-only (encode throws `EncodingError`) — add fields to the `init(from:)` decoder and the memberwise `init`, but do NOT change the encode path.
- v2 adds `image_attributions` column — decide whether to decode it or ignore it. Safest: ignore (no `CodingKey` entry needed; missing keys with `decodeIfPresent` are nil, absent keys with no entry are simply not read).
- `events_enriched_v2` `parent_tips` is jsonb: array of `{category: string, text: string}` objects (1-3 elements) or NULL. Swift type: `[[String: String]]?` or a typed `ParentTip` struct. The typed struct is safer for future use but `[[String: String]]?` is simpler. Use `decodeIfPresent([ParentTip].self)` with a small `Codable` struct.

## Common Pitfalls

- **`parent_tips` decode crash on null** — Use `decodeIfPresent` not `decode`. The migration confirms it is nullable. Test both nil and populated cases.
- **Age filter open-ended max** — Web uses 99 as `OPEN_ENDED_MAX_AGE` for events with no `age_max`. iOS must mirror this: when `event.ageMax == nil`, treat as 99. When `filter.max == nil` (9+ bucket), treat filter max as `Int.max`. The 9+ bucket is `min: 9, max: nil` — port this correctly.
- **v2 cursor params passed as nil** — The v2 RPC signature has `p_after_start_datetime` and `p_after_id` defaulting to NULL. If iOS passes `p_offset` (v1 style) with v2, it will still work because v2 supports offset via `p_after_*` being nil. But the `Params` struct encoding must NOT include unknown v2-only fields unless you want to enable cursor pagination.
- **Category chip single-select vs multi-select** — The context says `activeCategory: String?` (single-select at a time), matching the category chip UX (tap one, deselects previous). The filter sheet Tags section can be multi-select (`tagSlugs: Set<String>`) if desired, but the inline chip row is single-select. Keep the two separate to avoid over-engineering.
- **`ExploreFilters.activeCount` must include new filters** — The toolbar badge count and empty-state "Clear filters" button both use `activeCount`. If new fields are added but `activeCount` is not updated, the badge shows wrong count and the clear button may not appear.

## Open Risks

- `events_enriched_v2` in the current migration (009707) has `image_attributions` in its RETURNS TABLE but earlier version (009702) does not. The `eventColumns` select string needs to match the live schema. If local migration is at 009702 but production is at 009707, the column list may differ. **Mitigation:** Only select columns that exist in both versions, or select `*` for the RPC call (supabase-swift allows this).
- The `fetch(ids:)` method in `SupabaseEventRepository` also calls `events_enriched` (v1). It should also be migrated to v2 for consistency, but its `Params` struct is different (takes `p_event_ids` array). Confirm the v2 `p_event_ids` param works identically.
- `ExploreViewModel` uses `@Observable` + `@MainActor` — any new filter fields trigger the `didSet` reactive reload. This is correct behavior but verify that setting `activeCategory = nil` (deselecting) also triggers a reload that restores the full list.

## Skills Discovered

| Technology | Skill | Status |
|------------|-------|--------|
| SwiftUI | `swiftui-patterns` | installed |
| SwiftUI | `swiftui-layout-components` | installed |
| Swift | `swift-language` | installed |
| Swift Testing | `swift-testing` | installed |
| Supabase | `supabase` | installed |
