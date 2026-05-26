---
estimated_steps: 12
estimated_files: 3
skills_used: []
---

# T01: Added ParentTip struct + isOutdoor/parentTips fields to EventDTO (decodeIfPresent), migrated both SupabaseEventRepository RPC calls to events_enriched_v2, and added two unit tests covering v2 fields present and absent.

**Why**: iOS EventDTO is missing isOutdoor and parentTips fields that events_enriched_v2 returns. SupabaseEventRepository still calls the deprecated v1 RPC. Migrating is required for R008 and is the highest-risk task (decode crash if parentTips is mis-typed). Do this first so T02/T03 can use the updated fixture shape.

**Do**:
1. In EventDTO.swift: Add a `ParentTip` struct before `EventDTO` — `public struct ParentTip: Codable, Equatable, Sendable { public let category: String; public let text: String }`.
2. Add `public let isOutdoor: Bool?` and `public let parentTips: [ParentTip]?` to EventDTO's property list (after `isFavorited`).
3. Add CodingKeys cases: `case isOutdoor = "is_outdoor"` and `case parentTips = "parent_tips"`.
4. In `init(from:)`: add `isOutdoor = try c.decodeIfPresent(Bool.self, forKey: .isOutdoor)` and `parentTips = try c.decodeIfPresent([ParentTip].self, forKey: .parentTips)`. Use `decodeIfPresent` — NOT `decode` — both are nullable. Also wrap each in the `try?` pattern only if consistent with adjacent optional fields; the existing pattern uses direct `try c.decodeIfPresent` for non-critical optionals — follow that.
5. Add `isOutdoor: Bool? = nil, parentTips: [ParentTip]? = nil` to the memberwise `init` signature and assign them.
6. In EventRepository.swift: append `,is_outdoor,parent_tips` to the `eventColumns` static string.
7. Change both `.rpc("events_enriched", params: params)` calls to `.rpc("events_enriched_v2", params: params)` — one in `fetch(ids:)` and one in `fetchList(query:for:)`.
8. In EventDTOTests.swift: Add `testDecodesV2FieldsWhenPresent` — JSON payload includes `"is_outdoor": true` and `"parent_tips": [{"category": "Fun", "text": "Good for toddlers"}]` — assert `dto.isOutdoor == true` and `dto.parentTips?.first?.category == "Fun"` and `dto.parentTips?.first?.text == "Good for toddlers"`.
9. Add `testDecodesV2FieldsWhenAbsent` — JSON payload omits the `is_outdoor` and `parent_tips` keys entirely (absent, not null) — assert both `dto.isOutdoor == nil` and `dto.parentTips == nil`, no throw.

**Done when**: EventDTO.swift contains parentTips and isOutdoor fields decoded with decodeIfPresent; EventRepository.swift references events_enriched_v2 in both RPC calls; EventDTOTests.swift contains both new test methods.

## Inputs

- `apps/ios/Packages/FEData/Sources/FEData/DTOs/EventDTO.swift`
- `apps/ios/Packages/FEData/Sources/FEData/Repositories/EventRepository.swift`
- `apps/ios/Packages/FEData/Tests/FEDataTests/DTOs/EventDTOTests.swift`

## Expected Output

- `apps/ios/Packages/FEData/Sources/FEData/DTOs/EventDTO.swift`
- `apps/ios/Packages/FEData/Sources/FEData/Repositories/EventRepository.swift`
- `apps/ios/Packages/FEData/Tests/FEDataTests/DTOs/EventDTOTests.swift`

## Verification

grep -q "events_enriched_v2" apps/ios/Packages/FEData/Sources/FEData/Repositories/EventRepository.swift && grep -q "parentTips" apps/ios/Packages/FEData/Sources/FEData/DTOs/EventDTO.swift && grep -q "testDecodesV2Fields" apps/ios/Packages/FEData/Tests/FEDataTests/DTOs/EventDTOTests.swift

## Observability Impact

RPC name change (events_enriched → events_enriched_v2) is visible in Supabase dashboard logs and Xcode network instruments. No structured logging changes.
