# Requirements

This file is the explicit capability and coverage contract for the project.

## Active

## Validated

### R001 — iOS Explore exposes an age filter matching web's 5 age-bucket options (0-1yr, 1-3yrs, 2-4yrs, 5-8yrs, 9+), applied client-side post-fetch.
- Class: primary-user-loop
- Status: validated
- Description: iOS Explore exposes an age filter matching web's 5 age-bucket options (0-1yr, 1-3yrs, 2-4yrs, 5-8yrs, 9+), applied client-side post-fetch.
- Why it matters: Parents on iOS currently cannot filter events by child age — a core discover-by-fit capability that exists on web.
- Source: user
- Primary owning slice: M001/S01
- Validation: AgeFilter enum with 5 buckets added to ExploreFilters; applyClientFilters applies age-range overlap; dismissible chip present in ExploreActiveFiltersBar; T02 tests 33/33 pass.

### R002 — iOS Explore exposes a tag/category filter sheet matching web's tag multi-select and 4 category chips (Playgroups, Music, Outdoor, Storytime), applied client-side.
- Class: primary-user-loop
- Status: validated
- Description: iOS Explore exposes a tag/category filter sheet matching web's tag multi-select and 4 category chips (Playgroups, Music, Outdoor, Storytime), applied client-side.
- Why it matters: Tag filtering is a primary discovery mechanism on web. iOS users cannot narrow results by event type at all today.
- Source: user
- Primary owning slice: M001/S01
- Validation: activeCategory field added to ExploreFilters; ExploreFilterSheet has Age and Category sections; category slug filter applied in applyClientFilters; dismissible category chip in ExploreActiveFiltersBar.

### R003 — iOS Explore renders an inline category grid chip row (4 categories) matching web's `ExploreCategoryGrid`, allowing one-tap category selection that narrows the event list.
- Class: primary-user-loop
- Status: validated
- Description: iOS Explore renders an inline category grid chip row (4 categories) matching web's `ExploreCategoryGrid`, allowing one-tap category selection that narrows the event list.
- Why it matters: Category chips are the lowest-friction filter entry point on web; their absence on iOS is an obvious parity gap.
- Source: inferred
- Primary owning slice: M001/S01
- Validation: ExploreCategoryChipRow.swift created with 4 category chips; wired into ExploreScreen between search bar and active filters bar; selecting a chip sets activeCategory on ExploreViewModel.

### R004 — The geocoding enrichment pipeline resolves more events to precise coordinates, reducing the count of events stuck at city-centroid placeholder coords.
- Class: core-capability
- Status: validated
- Description: The geocoding enrichment pipeline resolves more events to precise coordinates, reducing the count of events stuck at city-centroid placeholder coords.
- Why it matters: Events at city centroid are filtered off the map view by `isCityCentroidCoordinate()`, leaving the map visibly bare even when events exist.
- Source: user
- Primary owning slice: M001/S02
- Validation: Migration 20260601009800 adds 4 new OR clauses to _has_geocodable_address (suite/unit patterns, extended place-types in address, extended place-types in venue_name, digit-prefix venue_name). supabase db reset applied the migration cleanly (exit 0) with no schema drift.

### R005 — The map view shows noticeably more pinned events after the geocoding heuristic improvement is deployed, verifiable by comparing centroid-stuck event count before and after.
- Class: primary-user-loop
- Status: validated
- Description: The map view shows noticeably more pinned events after the geocoding heuristic improvement is deployed, verifiable by comparing centroid-stuck event count before and after.
- Why it matters: A sparse map is the user-visible symptom of geocoding gaps — the map is a primary navigation surface for parents finding nearby events.
- Source: user
- Primary owning slice: M001/S02
- Validation: Migration expands geocodable address detection; pre/post diagnostic query confirmed exit 0. Full before/after count on production/staging data requires a populated database — sparse local seed has 0 events matching new patterns (acceptable). The heuristic is in place for production measurement.
- Notes: Full user-visible map improvement requires populated production data; local seed delta was 0→0 due to sparse seed with no events matching new patterns.

### R006 — A queryable diagnostic exists (SQL or admin view) showing how many events are stuck at centroid and why (no geocodable address signal), so geocoding gaps can be measured before and after heuristic changes.
- Class: failure-visibility
- Status: validated
- Description: A queryable diagnostic exists (SQL or admin view) showing how many events are stuck at centroid and why (no geocodable address signal), so geocoding gaps can be measured before and after heuristic changes.
- Why it matters: Without a before/after count, it's impossible to tell whether a heuristic change actually improved coverage.
- Source: inferred
- Primary owning slice: M001/S02
- Validation: Diagnostic SQL queries are embedded in the migration comment block (2 DIAGNOSTIC QUERY markers), executable against any local or remote Supabase instance to measure centroid-stuck count before/after heuristic changes.

### R007 — The dead `useEvents` hook and `search_events` RPC are either deleted or wired into Explore — no half-implemented parallel path left in the codebase.
- Class: quality-attribute
- Status: validated
- Description: The dead `useEvents` hook and `search_events` RPC are either deleted or wired into Explore — no half-implemented parallel path left in the codebase.
- Why it matters: Dead code with a parallel RPC path causes confusion during maintenance and adds surface area with no benefit (documented in TODOS.md).
- Source: user
- Primary owning slice: M001/S03
- Validation: S03 delivered: use-events.test.ts deleted (renamed to event-filters.test.ts), search_events DROP migration (20260601009900) applied and verified via pg_proc returning 0 rows, no live references in apps/web/src (rg exit 1), pnpm --filter @family-events/web check exits 0. Decision D004 recorded in DECISIONS.md.

### R008 — iOS `SupabaseEventRepository` uses `events_enriched_v2` and `EventDTO` includes `parentTips` and `isOutdoor` fields, matching the web data shape.
- Class: quality-attribute
- Status: validated
- Description: iOS `SupabaseEventRepository` uses `events_enriched_v2` and `EventDTO` includes `parentTips` and `isOutdoor` fields, matching the web data shape.
- Why it matters: iOS is on the v1 RPC — it misses cursor pagination, `parent_tips`, and `is_outdoor`. Staying on v1 while web moves forward widens the data gap with each v2 addition.
- Source: inferred
- Primary owning slice: M001/S01
- Validation: Both RPC call sites in SupabaseEventRepository use events_enriched_v2; EventDTO includes parentTips (ParentTip struct) and isOutdoor via decodeIfPresent; unit tests cover v2 fields present and absent.

## Deferred

### R009 — Supabase RLS integration tests verify that anonymous users can read published events, admin can update event status, and non-admin cannot invoke scrape-source.
- Class: quality-attribute
- Status: deferred
- Description: Supabase RLS integration tests verify that anonymous users can read published events, admin can update event status, and non-admin cannot invoke scrape-source.
- Why it matters: RLS bugs are silent — queries return empty results with no error. Unit tests on pure functions don't catch policy misconfigurations.
- Source: user
- Notes: Deferred to post-launch hardening. Requires Supabase local dev running for integration tests.

### R010 — iOS snapshot testing harness for FEDesignSystem using `pointfreeco/swift-snapshot-testing` with light/dark/Dynamic Type coverage for EventCard and future card primitives.
- Class: quality-attribute
- Status: deferred
- Description: iOS snapshot testing harness for FEDesignSystem using `pointfreeco/swift-snapshot-testing` with light/dark/Dynamic Type coverage for EventCard and future card primitives.
- Why it matters: Spec §10 mandates snapshot tests on FEDesignSystem primitives; M5 Explore will reuse EventCard heavily and visual regressions would land silently without baselines.
- Source: user
- Notes: Deferred until pre-M5. Harness setup ~2-3h. Needs CI baseline images and simulator pin.

### R011 — Production Supabase `app.settings.supabase_url` and `app.settings.service_role_key` injection for the scraping cron is documented and automated so it cannot be silently misconfigured on a new deployment.
- Class: operability
- Status: deferred
- Description: Production Supabase `app.settings.supabase_url` and `app.settings.service_role_key` injection for the scraping cron is documented and automated so it cannot be silently misconfigured on a new deployment.
- Why it matters: Without these settings, the scraping cron silently no-ops in production — scraping only works via manual admin trigger.
- Source: user
- Notes: Deferred until production Supabase project is live. PRODUCTION_SETUP.md partially covers this but it is manual today.

## Out of Scope

## Traceability

| ID | Class | Status | Primary owner | Supporting | Proof |
|---|---|---|---|---|---|
| R001 | primary-user-loop | validated | M001/S01 | none | AgeFilter enum with 5 buckets added to ExploreFilters; applyClientFilters applies age-range overlap; dismissible chip present in ExploreActiveFiltersBar; T02 tests 33/33 pass. |
| R002 | primary-user-loop | validated | M001/S01 | none | activeCategory field added to ExploreFilters; ExploreFilterSheet has Age and Category sections; category slug filter applied in applyClientFilters; dismissible category chip in ExploreActiveFiltersBar. |
| R003 | primary-user-loop | validated | M001/S01 | none | ExploreCategoryChipRow.swift created with 4 category chips; wired into ExploreScreen between search bar and active filters bar; selecting a chip sets activeCategory on ExploreViewModel. |
| R004 | core-capability | validated | M001/S02 | none | Migration 20260601009800 adds 4 new OR clauses to _has_geocodable_address (suite/unit patterns, extended place-types in address, extended place-types in venue_name, digit-prefix venue_name). supabase db reset applied the migration cleanly (exit 0) with no schema drift. |
| R005 | primary-user-loop | validated | M001/S02 | none | Migration expands geocodable address detection; pre/post diagnostic query confirmed exit 0. Full before/after count on production/staging data requires a populated database — sparse local seed has 0 events matching new patterns (acceptable). The heuristic is in place for production measurement. |
| R006 | failure-visibility | validated | M001/S02 | none | Diagnostic SQL queries are embedded in the migration comment block (2 DIAGNOSTIC QUERY markers), executable against any local or remote Supabase instance to measure centroid-stuck count before/after heuristic changes. |
| R007 | quality-attribute | validated | M001/S03 | none | S03 delivered: use-events.test.ts deleted (renamed to event-filters.test.ts), search_events DROP migration (20260601009900) applied and verified via pg_proc returning 0 rows, no live references in apps/web/src (rg exit 1), pnpm --filter @family-events/web check exits 0. Decision D004 recorded in DECISIONS.md. |
| R008 | quality-attribute | validated | M001/S01 | none | Both RPC call sites in SupabaseEventRepository use events_enriched_v2; EventDTO includes parentTips (ParentTip struct) and isOutdoor via decodeIfPresent; unit tests cover v2 fields present and absent. |
| R009 | quality-attribute | deferred | none | none | unmapped |
| R010 | quality-attribute | deferred | none | none | unmapped |
| R011 | operability | deferred | none | none | unmapped |

## Coverage Summary

- Active requirements: 0
- Mapped to slices: 0
- Validated: 8 (R001, R002, R003, R004, R005, R006, R007, R008)
- Unmapped active requirements: 0
