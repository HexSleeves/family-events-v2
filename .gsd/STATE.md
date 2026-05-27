# GSD State

**Active Milestone:** M002: Image Generation Fallback Flow - Two-Pass Search
**Active Slice:** None
**Phase:** validating-milestone
**Requirements Status:** 0 active · 0 validated · 0 deferred · 0 out of scope

## Milestone Registry
- ✅ **M001:** iOS Parity + Geocoding Hardening
- 🔄 **M002:** Image Generation Fallback Flow - Two-Pass Search

## Recent Decisions
- D001 (M001 planning): Where iOS Explore tag and age filtering executes -> Client-side in ExploreViewModel.applyClientFilters, post-fetch
- D002 (M001 planning): iOS RPC version for event fetching -> Migrate iOS SupabaseEventRepository from events_enriched (v1) to events_enriched_v2
- D003 (M001 planning): Geocoding improvement strategy for centroid-stuck events -> Widen _has_geocodable_address predicate in list_events_needing_enrichment — no city-centroid fallback write-back
- D004 (M001/S03 planning): Fate of the search_events RPC in the database -> Deleted via DROP migration — not wired into any new TypeScript caller
- D005 (architecture): Deleted via DROP migration — not wired into any new TypeScript caller -> Zero callers in apps/web/src, zero callers in edge functions or cron scripts. search_events_v2 covers the cursor-based path and is the canonical RPC. The v1 function carries dead schema surface with no upgrade path worth implementing at current state.

## Blockers
- None

## Next Action
Validate milestone M002 before completion.
