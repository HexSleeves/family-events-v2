---
id: S03
parent: M001
milestone: M001
provides:
  - Clean web codebase: no use-events.ts remnant, no search_events v1 RPC, no dangling type bindings
  - Migration 20260601009900 drops search_events from DB
  - pnpm --filter @family-events/web check exits 0
requires:
  - slice: S01
    provides: No shared contract — S03 is web-only dead code removal independent of iOS changes
  - slice: S02
    provides: Confirmed absence of search_events callers in edge functions (grep evidence)
affects:
  []
key_files:
  - apps/web/src/features/events/hooks/event-filters.test.ts
  - supabase/migrations/20260601009900_drop_search_events_rpc.sql
  - packages/contracts/src/database.types.ts
  - scripts/test.sh
  - scripts/db/collect-db-evidence.sql
key_decisions:
  - Decision D004: search_events RPC deleted via DROP migration — zero callers in apps/web/src, zero edge-function callers, superseded by search_events_v2
patterns_established:
  - Dead-code removal verified by 4-gate checklist: file-existence, TypeScript check, DB reset, pg_proc row count
observability_surfaces:
  - None — dead code removal has no runtime observability surface
drill_down_paths:
  - .gsd/milestones/M001/slices/S03/tasks/T01-SUMMARY.md
  - .gsd/milestones/M001/slices/S03/tasks/T02-SUMMARY.md
  - .gsd/milestones/M001/slices/S03/tasks/T03-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-05-26T16:57:29.802Z
blocker_discovered: false
---

# S03: Dead Code Removal

**Deleted use-events.test.ts (renamed to event-filters.test.ts), dropped the search_events RPC via migration 20260601009900, scrubbed all v1 references from database.types.ts, test.sh, and collect-db-evidence.sql — pnpm web check exits 0, pg_proc confirms 0 rows for search_events.**

## What Happened

S03 was the final cleanup slice for M001. All three tasks found the necessary changes already pre-applied and focused on verification. T01 confirmed use-events.test.ts renamed to event-filters.test.ts with 392 tests passing. T02 verified the DROP migration, database.types.ts scrub, test.sh cleanup, pgTAP deletion, and collect-db-evidence.sql comment — then recorded Decision D004. T03 ran all four gates and confirmed full clean state.

## Verification

All four S03 gates verified: pnpm check exits 0, db reset applies migration cleanly, pg_proc returns 0 rows for search_events, rg finds no live references in apps/web/src.

## Requirements Advanced

- R007 — use-events.ts deleted, search_events DROP migration applied, no live references in web src, pnpm check exits 0

## Requirements Validated

- R007 — All four verification gates passed: file absence confirmed, pnpm check exits 0, db reset applies migration cleanly, pg_proc returns 0 rows for search_events

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Operational Readiness

None.

## Deviations

None. All work was pre-applied before task execution; tasks focused on verification and confirmation.

## Known Limitations

None. This is a complete dead-code removal with all gates passing.

## Follow-ups

None.

## Files Created/Modified

- `apps/web/src/features/events/hooks/use-events.test.ts` — Deleted (renamed to event-filters.test.ts)
- `apps/web/src/features/events/hooks/event-filters.test.ts` — Created — rename of use-events.test.ts to reflect actual content (matchesAgeFilter, normalizeKeyword tests)
- `supabase/migrations/20260601009900_drop_search_events_rpc.sql` — Created — DROP FUNCTION migration for search_events RPC
- `supabase/tests/search_events_full_text.sql` — Deleted — pgTAP test for the now-dropped RPC
- `packages/contracts/src/database.types.ts` — search_events v1 block (lines 2750–2823) removed; search_events_v2 block untouched
- `scripts/test.sh` — Line referencing search_events_full_text.sql removed
- `scripts/db/collect-db-evidence.sql` — search_events EXPLAIN block commented out
