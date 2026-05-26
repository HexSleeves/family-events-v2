# S02: Geocoding Heuristic Improvement

**Goal:** Write a SQL migration that widens the `_has_geocodable_address` predicate in `list_events_needing_enrichment` with additional venue patterns (suite/unit numbers, extended place-type words, venue_name street-address prefix), verify it applies cleanly with `supabase db reset`, and confirm the diagnostic SQL runs without error and shows a higher newly-eligible count than the 009700 baseline.
**Demo:** supabase db reset applies the new migration cleanly. A diagnostic SQL query run before and after shows a lower centroid-stuck count on local seed data. Migration comment explains the new patterns added.

## Must-Haves

- `supabase db reset` exits 0 with the new migration in place
- Diagnostic query (`newly_eligible`) returns a count ≥ 009700 baseline (seed-data delta may be zero; the query must at least run without error)
- Migration comment explains each new pattern category
- `supabase db diff` shows only function replacement — no table schema changes
- R004, R005, R006 requirements are satisfied: pipeline eligible pool widens, diagnostic query exists in migration comment

## Proof Level

- This slice proves: integration — migration applies against real Supabase local stack; diagnostic SQL exercises actual seed data

## Integration Closure

Upstream: `private.list_events_needing_enrichment` and `public.list_events_needing_enrichment` function signatures are unchanged — backfill-event-enrichment edge function requires no code change. Downstream: S03 needs grep evidence that `search_events` has no edge-function callers (confirmed in research; no action needed here). Nothing in this slice touches iOS or web application code.

## Verification

- Diagnostic query comment embedded in migration is the R006 observability artifact. Executor should record the before/after `newly_eligible` count in the task summary so it is preserved for milestone validation.

## Tasks

- [x] **T01: Created 009800 migration expanding _has_geocodable_address with 4 new OR clauses (suite/unit, extended place-types in address, extended place-types in venue_name, venue_name street-number prefix) plus embedded diagnostic queries** `est:30m`
  **Why:** The current `_has_geocodable_address` predicate (009700) covers street numbers, street-type words, and a set of place-type words, but misses suite/unit indicators, family-event venue types (Gym, Cafe, Brewery, Pool, etc.), and venue_name street-address prefixes. Widening the predicate adds more events to the geocoding-eligible pool without re-introducing libcal room-label noise.
  - Files: `supabase/migrations/20260601009800_enrichment_geocodable_address_expand_2.sql`
  - Verify: test -f supabase/migrations/20260601009800_enrichment_geocodable_address_expand_2.sql

- [x] **T02: supabase db reset exited 0 applying 009800 migration; pre/post diagnostic counts recorded (newly_eligible: 0→0 on sparse seed, no SQL errors)** `est:20m`
  **Why:** The slice success criterion requires `supabase db reset` to apply the new migration cleanly (exit code 0) and the diagnostic SQL to show the newly-eligible count is ≥ the 009700 baseline. This task proves the migration is syntactically and semantically valid against the real local Supabase stack.
  - Verify: supabase db reset

## Files Likely Touched

- supabase/migrations/20260601009800_enrichment_geocodable_address_expand_2.sql
