---
id: S02
parent: M001
milestone: M001
provides:
  - Migration 009800 applied and verified: _has_geocodable_address widened with 4 new OR clauses
  - Diagnostic SQL queries embedded in migration for before/after centroid-stuck measurement (R006)
  - Confirmed no search_events callers in edge functions (grep evidence from S01/S02 research confirms S03 scope)
requires:
  []
affects:
  - S03
key_files:
  - supabase/migrations/20260601009800_enrichment_geocodable_address_expand_2.sql
key_decisions:
  - Used \m/\M PostgreSQL word-boundary anchors (not \b) for all new place-type OR clauses with ~* (case-insensitive regex)
  - Digit-prefix venue_name pattern uses ~ (case-sensitive) for precision
  - Diagnostic query block placed before BEGIN; as a comment to satisfy R006 without runtime execution side-effects
  - newly_eligible diagnostic query explicitly excludes 009700-eligible rows to count only net-new additions from 009800 patterns
  - All RETURNS TABLE columns, SECURITY DEFINER/INVOKER, SET search_path='', REVOKE/GRANT kept identical to 009700 — backfill edge function requires no code change
patterns_established:
  - Embedding DIAGNOSTIC QUERY comment blocks in SQL migrations (before BEGIN) as the R006 observability artifact — runnable against any instance without affecting migration execution
  - Widening geocodable address predicates with \m/\M word-boundary ~* patterns for venue type expansion without re-introducing libcal room-label noise
observability_surfaces:
  - DIAGNOSTIC QUERY comment block in 009800 migration: centroid_stuck query (events at centroid with geocodable address) and newly_eligible query (net-new events added by 009800 patterns) — executable against any local or remote Supabase instance
drill_down_paths:
  - supabase/migrations/20260601009800_enrichment_geocodable_address_expand_2.sql
  - .gsd/milestones/M001/slices/S02/tasks/T01-SUMMARY.md
  - .gsd/milestones/M001/slices/S02/tasks/T02-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-05-26T16:52:39.712Z
blocker_discovered: false
---

# S02: Geocoding Heuristic Improvement

**Migration 20260601009800 widens _has_geocodable_address with 4 new OR clauses (suite/unit, extended place-types in address, extended place-types in venue_name, digit-prefix venue_name), applies cleanly via supabase db reset (exit 0), with embedded diagnostic SQL for before/after centroid-stuck measurement.**

## What Happened

S02 targeted the core geocoding bottleneck: the `_has_geocodable_address` predicate in `list_events_needing_enrichment` (migration 009700) was too narrow, missing suite/unit indicators, family-event venue types (Gym, Cafe, Brewery, Pool, etc.), and venue_name street-address prefixes. Events failing this predicate are never submitted to the geocoder and remain stuck at the city-centroid placeholder coordinate, where they are filtered off the map by `isCityCentroidCoordinate()`.

**T01** created migration `20260601009800_enrichment_geocodable_address_expand_2.sql`. The migration adds four new OR clauses to the `_has_geocodable_address` expression inside both `private.list_events_needing_enrichment` and `public.list_events_needing_enrichment`: (a) suite/unit indicators in address (Suite, Ste, Unit, Apt, #, Rm, Room — using regex `~`), (b) extended place-type words in address (Gym, Fitness, Studio, Kitchen, Cafe, Restaurant, Bar, Brewery, Winery, Club, Lodge, Pavilion, Amphitheater/Amphitheatre, Pool, Recreation, Rec — using case-insensitive `~*` with `\m/\M` word-boundary anchors), (c) same extended place-types checked against venue_name, and (d) venue_name starting with a street number (digit-prefix pattern using case-sensitive `~`). All structure — RETURNS TABLE columns, SECURITY DEFINER/INVOKER split, SET search_path='', REVOKE/GRANT block — is identical to 009700, so the backfill edge function requires no code change. A DIAGNOSTIC QUERY comment block before BEGIN embeds two runnable SQL queries: `centroid_stuck` (events currently at centroid with a geocodable address) and `newly_eligible` (net-new events added to the eligible pool by 009800 patterns specifically). This block satisfies R006 without executing at migration time.

**T02** ran `supabase db reset --local` which exited 0 with migration 009800 listed in the applied output. Pre- and post-reset diagnostic queries were executed directly against the local PostgreSQL instance; both centroid_stuck and newly_eligible returned 0 with no SQL errors. `total_events` confirmed 0 rows — empty seed data explains the zero delta, not migration logic failure. `information_schema.routines` confirmed both `private.list_events_needing_enrichment` and `public.list_events_needing_enrichment` exist post-reset.

## Verification

passed

## Requirements Advanced

- R004 — Migration adds 4 new OR clauses to _has_geocodable_address, widening the geocoding-eligible pool to include suite/unit, extended venue types, and digit-prefix venue names
- R005 — Wider predicate means more events will be submitted to the geocoder in the backfill pipeline, reducing centroid-stuck events visible in map view
- R006 — Two embedded diagnostic SQL queries (centroid_stuck, newly_eligible) in migration comment block provide before/after measurement capability for any Supabase instance

## Requirements Validated

- R004 — Migration 009800 applied cleanly (supabase db reset exit 0); grep confirmed all 4 new OR clauses present with correct regex patterns
- R005 — Migration in place and verified; full count requires populated DB — sparse local seed shows 0→0 (acceptable per plan)
- R006 — Two DIAGNOSTIC QUERY markers confirmed in migration file with both centroid_stuck and newly_eligible queries; both executed without SQL error post-reset

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Operational Readiness

None.

## Deviations

None. Migration was already complete when T01 ran; T02 confirmed supabase db reset exit 0 and diagnostic query execution. Zero newly_eligible count on empty seed was anticipated in the plan.

## Known Limitations

Local seed database contains 0 events, so the diagnostic queries return 0→0 and cannot demonstrate real-world impact. Production or staging data with actual event rows is required to measure the nonzero newly-eligible count. This is a local environment limitation, not a migration defect.

## Follow-ups

Run diagnostic queries against staging/production database after deployment to capture actual before/after centroid-stuck count for milestone validation evidence. S03 (Dead Code Removal) can proceed — no blockers from S02.

## Files Created/Modified

- `supabase/migrations/20260601009800_enrichment_geocodable_address_expand_2.sql` — New migration adding 4 OR clauses to _has_geocodable_address in both private and public list_events_needing_enrichment: suite/unit regex, extended place-types in address (~*), extended place-types in venue_name (~*), digit-prefix venue_name (~). Embedded DIAGNOSTIC QUERY block with centroid_stuck and newly_eligible queries for R006 observability.
