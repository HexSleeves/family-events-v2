# M001: iOS Parity and Geocoding Hardening

**Vision:** iOS Explore reaches filter parity with web (age, tags, category grid), iOS moves to events_enriched_v2, the map shows more pinned events after geocoding heuristic improvements, and dead web code is cleaned up.

## Success Criteria

- iOS Explore filter sheet includes age buckets and tag/category selection matching web's filter vocabulary
- iOS EventDTO includes parentTips and isOutdoor; SupabaseEventRepository calls events_enriched_v2
- A SQL diagnostic query shows measurably fewer centroid-stuck events after the geocoding migration
- useEvents hook and search_events RPC are deleted or wired — no dangling TODO state
- pnpm --filter @family-events/web check and iOS swift test both pass

## Slices

- [x] **S01: iOS Explore Filter Parity** `risk:high` `depends:[]`
  > After this: iOS Explore shows 4 category chips inline, filter sheet has Age and Category sections, selecting '0-1yr' narrows the event list, active filters show dismissible chips — and EventDTO decodes v2 fields without crash.

- [x] **S02: Geocoding Heuristic Improvement** `risk:medium` `depends:[]`
  > After this: supabase db reset applies the new migration cleanly. A diagnostic SQL query run before and after shows a lower centroid-stuck count on local seed data. Migration comment explains the new patterns added.

- [x] **S03: Dead Code Removal** `risk:low` `depends:[S01,S02]`
  > After this: src/hooks/use-events.ts is gone. pnpm --filter @family-events/web check passes. A decision is recorded in DECISIONS.md for what happened to search_events.

## Boundary Map

### S01 → S03

Produces:
- No shared contract (S03 is web-only dead code removal, independent of iOS changes)

Consumes:
- nothing

### S02 → S03

Produces:
- Confirmed absence of search_events callers in edge functions (grep evidence)

Consumes:
- nothing (independent; S03 greps independently but S02's scope confirms edge function caller list)
