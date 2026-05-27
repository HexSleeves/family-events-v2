---
estimated_steps: 10
estimated_files: 3
skills_used: []
---

# T02: Validate EventDTO v2 Migration and Tests

**Why:** Confirm iOS EventDTO successfully migrated to events_enriched v2 with parentTips and isOutdoor fields, and decode tests pass.

**Do:**
1. Run FEData test suite: `cd apps/ios && swift test --package-path Packages/FEData`
2. Verify test count matches documented count (expect 75+ tests including EventDTOTests)
3. Check EventDTO.swift contains isOutdoor: Bool? and parentTips: [ParentTip]? fields
4. Check EventDTO.swift uses decodeIfPresent for both fields
5. Verify SupabaseEventRepository.swift calls events_enriched (the canonical RPC, was v2) for both fetch and fetchList
6. Check eventColumns string includes is_outdoor and parent_tips
7. Append findings to validation report

**Done when:** FEData tests exit 0 with all tests passing, EventDTO confirmed to have v2 fields with proper decode pattern, validation report updated

## Inputs

- `apps/ios/Packages/FEData/Sources/FEData/DTOs/EventDTO.swift`
- `apps/ios/Packages/FEData/Sources/FEData/Repositories/EventRepository.swift`
- `.gsd/milestones/M001/slices/S01/validation-report.md`

## Expected Output

- `.gsd/milestones/M001/slices/S01/validation-report.md`

## Verification

grep -q EventDTO .gsd/milestones/M001/slices/S01/validation-report.md
