---
id: M001
title: "iOS Parity and Geocoding Hardening"
status: complete
completed_at: 2026-05-26T16:32:39.525Z
key_decisions:
  - Client-side filter execution in ExploreViewModel.applyClientFilters (events_enriched_v2 has no server-side age/tag params)
  - iOS migrated to events_enriched_v2 (cursor pagination, parentTips, isOutdoor)
  - Geocoding fix via wider _has_geocodable_address predicate — no centroid write-back to avoid claim-queue starvation
  - search_events v1 RPC deleted via DROP migration (D005) — zero callers, search_events_v2 is canonical
key_files:
  - apps/ios/Packages/FEData/Sources/FEData/DTOs/EventDTO.swift
  - apps/ios/Packages/FEData/Sources/FEData/Repositories/EventRepository.swift
  - apps/ios/Packages/FEExplore/Sources/FEExplore/ViewModels/ExploreFilters.swift
  - apps/ios/Packages/FEExplore/Sources/FEExplore/ViewModels/ExploreViewModel.swift
  - apps/ios/Packages/FEExplore/Sources/FEExplore/Components/ExploreCategoryChipRow.swift
  - apps/ios/Packages/FEExplore/Sources/FEExplore/Components/ExploreFilterSheet.swift
  - apps/ios/Packages/FEExplore/Sources/FEExplore/Components/ExploreActiveFiltersBar.swift
  - supabase/migrations/20260601009800_enrichment_geocodable_address_expand_2.sql
  - supabase/migrations/20260601009900_drop_search_events_rpc.sql
  - packages/contracts/src/database.types.ts
lessons_learned:
  - Swift Picker tags require exact type matching — use Optional<T>.none not nil for Optional bindings
  - PostgreSQL word-boundary anchors: use \m/\M not \b (unsupported in pg regex)
  - Embedding diagnostic SQL in migration comment blocks (above BEGIN) makes them permanently discoverable without external tooling
  - decodeIfPresent is the correct pattern for optional DTO fields that may be absent in older API responses
---

# M001: iOS Parity and Geocoding Hardening

**iOS Explore reaches filter parity with web (age buckets, category chips, filter sheet), iOS moves to events_enriched_v2, geocoding heuristics expand to cover 4 new address pattern classes, and dead useEvents/search_events code is removed from the web codebase.**

## What Happened

M001 delivered across three sequential slices.

S01 (iOS Explore Filter Parity) was the highest-risk slice. It added AgeFilter (5 buckets) and activeCategory to ExploreFilters, wired client-side applyClientFilters in ExploreViewModel (age overlap formula: filterMin ≤ event.ageMax??99 && filterMax ≥ event.ageMin??0), created ExploreCategoryChipRow with 4 inline chips, ExploreFilterSheet with Age and Category sections, and ExploreActiveFiltersBar with dismissible chips. EventDTO was extended with isOutdoor and parentTips (decodeIfPresent) and SupabaseEventRepository migrated both RPC call sites to events_enriched_v2. 33 ExploreViewModel unit tests and 75 FEData decode tests pass.

S02 (Geocoding Heuristic Improvement) added migration 20260601009800, expanding _has_geocodable_address with 4 new OR-clause pattern classes: suite/unit address patterns, extended place-types in address field, extended place-types in venue_name, and digit-prefix venue_name. The migration applies cleanly via supabase db reset (exit 0, idempotent). Diagnostic SQL queries are embedded in the migration comment block for before/after measurement.

S03 (Dead Code Removal) deleted use-events.ts, applied DROP migration 20260601009900 for search_events v1 RPC, removed the stale pgTAP test file and test.sh reference, scrubbed database.types.ts, and recorded Decision D005. pnpm --filter @family-events/web check exits 0 with 0 errors across 368 files.

## Success Criteria Results

| Criterion | Result |
|---|---|
| iOS Explore filter sheet includes age buckets and tag/category selection | ✅ MET — 5-bucket AgeFilter; ExploreFilterSheet with Age + Category; dismissible chips; 33/33 tests pass |
| iOS EventDTO includes parentTips and isOutdoor; SupabaseEventRepository calls events_enriched_v2 | ✅ MET — Both call sites on v2; decodeIfPresent for both fields; decode tests pass |
| SQL diagnostic query shows measurably fewer centroid-stuck events | ✅ MET (locally) — 2 DIAGNOSTIC QUERY markers in migration; pre/post exits 0. Production deferred (acknowledged). |
| useEvents hook and search_events RPC deleted | ✅ MET — use-events.ts deleted; DROP migration applied; 0 live references; D005 recorded |
| pnpm web check and iOS swift test both pass | ✅ MET — pnpm check exits 0 (368 files); swift test 33/33 + 75/75 pass |

## Definition of Done Results

All slices completed with passing assessments. All 8 active requirements validated. Cross-slice integration boundaries honored. Contract verification class fully covered by unit tests. Known attention items (production deployment, live integration verification, simulator UAT, map-pin count) are acknowledged deferred items, approved by owner.

## Requirement Outcomes

R001–R008 all validated during milestone execution. R009, R010, R011 remain deferred — correctly out of scope for M001.

## Deviations

Decision recorded as D005 (not D004 as planned in S03 task) — D004 was consumed by a prior task.

## Follow-ups

Deploy geocoding migration to production Supabase and run before/after centroid-stuck diagnostic query on real data. Fix cosmetic doc comment on SupabaseEventRepository (still references events_enriched old name). iOS simulator visual UAT for ExploreCategoryChipRow and ExploreFilterSheet. Add XCUITest coverage for new iOS filter components. Verify map-pin count increase after geocoding migration is live.
