# M001: iOS Parity + Geocoding Hardening

**Vision:** Close the iOS-web feature gap in Explore filtering and improve map event density through geocoding heuristic expansion. This milestone documents work completed manually outside GSD workflow — iOS now has full filter parity (age buckets, category chips, tag selection), uses canonical events_enriched RPC with v2 fields (parentTips, isOutdoor), and geocoding heuristic has been progressively expanded through three migrations to capture suite/unit indicators and extended place-types.

## Success Criteria

- iOS ExploreFilterSheet shows Age section with 5 buckets (0-1yr, 1-3yr, 3-5yr, 5-9yr, 9+yr)
- iOS ExploreScreen displays inline category chips (Playgroups, Music, Outdoor, Storytime)
- Selecting age filter on iOS narrows event list to matching age ranges
- Selecting category chip filters to events with matching tag slug
- EventDTO decodes parentTips and isOutdoor without crashes (unit tests pass)
- iOS calls events_enriched (canonical RPC, was v2) with cursor pagination
- Geocoding heuristic expanded to include suite/unit, extended place-types, digit-prefix venue names
- Diagnostic SQL queries embedded in migration for centroid-stuck event measurement
- search_events v1 dropped, no references in web codebase
- All unit tests pass: ExploreViewModelTests, EventDTOTests

## Slices

- [x] **S01: Validation and Documentation of Completed Work** `risk:low` `depends:[]`
  > After this: All unit tests pass (ExploreViewModelTests, EventDTOTests). iOS Explore filter sheet shows age/category sections. Geocoding diagnostic queries embedded in migration comments. No search_events v1 references in codebase.

## Boundary Map

```
┌─────────────────────────────────────────────────────────────┐
│ iOS App (FEExplore, FEData)                                 │
│  ┌────────────────────────┐  ┌────────────────────────┐    │
│  │ ExploreScreen          │  │ ExploreViewModel       │    │
│  │ - Category chip row    │──│ - applyClientFilters   │    │
│  │ - Active filters bar   │  │ - age range overlap    │    │
│  └────────────────────────┘  └────────────────────────┘    │
│                                        │                     │
│  ┌─────────────────────────────────────▼──────────────┐    │
│  │ SupabaseEventRepository                            │    │
│  │ - fetchList(events_enriched) ← canonical RPC       │    │
│  └────────────────────────────────────┬───────────────┘    │
└────────────────────────────────────────┼────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Supabase (Production)                                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ events_enriched RPC (canonical, was v2)             │  │
│  │ Returns: parentTips (jsonb[]), isOutdoor (bool)     │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ _has_geocodable_address (geocoding heuristic)       │  │
│  │ Expanded: suite/unit, venue place-types, digit pfx  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Railway Cron (every 15 min)                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ backfill-event-enrichment edge function             │  │
│  │ Calls Nominatim, no centroid fallback write-back    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

**Key Boundaries:**
- iOS ↔ Supabase: RPC contract via events_enriched (canonical)
- Geocoding: Migration expands heuristic, function unchanged
- Web: search_events v1 dropped, no references remain
```
