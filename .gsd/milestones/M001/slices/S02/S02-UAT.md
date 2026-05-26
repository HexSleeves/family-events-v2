# S02: Geocoding Heuristic Improvement — UAT

**Milestone:** M001
**Written:** 2026-05-26T16:52:39.713Z

# S02: Geocoding Heuristic Improvement — UAT

**Milestone:** M001
**Written:** 2026-05-26

## UAT Type

- UAT mode: artifact-driven
- Why this mode is sufficient: The slice delivers a SQL migration artifact with no runtime service dependency beyond the local Supabase stack. Integration correctness is verified by `supabase db reset` (migration applies cleanly) and direct SQL execution of the diagnostic queries. No UI, API, or network surface is changed.

## Preconditions

1. Local Supabase stack is installed and functional (`supabase --version`)
2. Repository checked out with `supabase/migrations/20260601009800_enrichment_geocodable_address_expand_2.sql` present
3. `supabase db reset --local` is executable from the repository root

## Smoke Test

Run `test -f supabase/migrations/20260601009800_enrichment_geocodable_address_expand_2.sql && echo OK` — must print `OK`.

## Test Cases

### 1. Migration file existence and pattern completeness

1. Run `test -f supabase/migrations/20260601009800_enrichment_geocodable_address_expand_2.sql`
2. Inspect file for four new OR clauses: `suite/unit regex`, `address ~* '...(Gym|Cafe|Brewery|Pool...)...'`, `venue_name ~* '...(Gym|Cafe|Brewery|Pool...)...'`, `venue_name ~ '^[0-9]'`
3. Confirm DIAGNOSTIC QUERY comment block exists before `BEGIN;`
4. **Expected:** file exists (exit 0), all four OR-clause pattern groups present, DIAGNOSTIC QUERY block contains both `centroid_stuck` and `newly_eligible` queries

### 2. Migration applies cleanly

1. From repo root, run `supabase db reset --local`
2. Observe output — migration 009800 should appear in the applied list
3. **Expected:** exit code 0, no errors, 009800 migration listed as applied

### 3. Diagnostic queries execute without error

1. After `supabase db reset`, connect to local Supabase PostgreSQL (e.g., `psql "$LOCAL_DB_URL"`)
2. Run the `newly_eligible` query from the migration comment block
3. Run the `centroid_stuck` query from the migration comment block
4. **Expected:** both queries return a count (0 on empty seed, nonzero on populated data) with no SQL errors

### 4. Function signature unchanged

1. After reset, query `information_schema.routines WHERE routine_name = 'list_events_needing_enrichment'`
2. **Expected:** both `private` and `public` variants exist; RETURNS TABLE signature matches 009700 (12 columns in same order)

### 5. No table schema changes

1. Run `supabase db diff` against the local database after reset
2. **Expected:** diff shows only function replacement (`list_events_needing_enrichment` in both schemas), no table DDL changes

## Edge Cases

### Empty seed data shows zero delta

1. After reset with empty seed, run newly_eligible diagnostic query
2. **Expected:** count = 0 — this is correct behavior, not a migration failure. Production data with real events will show nonzero counts.

### Backfill edge function compatibility

1. Confirm `backfill-event-enrichment` edge function source has no changes required
2. **Expected:** edge function calls `public.list_events_needing_enrichment` — function signature (argument type `int`, same RETURNS TABLE columns) is unchanged, so edge function requires no modification

## Failure Signals

- `supabase db reset` exits non-zero or prints SQL error → migration syntax/semantic error
- `information_schema.routines` does not show both private and public variants → DROP/CREATE sequence failed
- `newly_eligible` or `centroid_stuck` queries return a SQL error (not a zero count) → diagnostic query syntax is broken
- `supabase db diff` shows table DDL changes → migration accidentally altered schema

## Not Proven By This UAT

- Real-world before/after centroid-stuck reduction (requires a populated database with actual event rows)
- Geocoder API actually being called for newly-eligible events (requires backfill-event-enrichment edge function execution against live data)
- Map UI showing more pins (requires iOS/web UI and live geocoder results)
- Performance impact of wider predicate on large event tables

## Notes for Tester

Zero diagnostic counts (0→0) on local seed are expected and correct — the local seed contains no events. The migration's correctness is proved by clean application and syntactically valid diagnostic SQL. To see real impact, run the diagnostic queries against a staging or production database where events exist: `newly_eligible` will return a nonzero count proportional to events at city-centroid with venue names/addresses matching the new patterns (Gym, Cafe, Brewery, Pool, suite/unit indicators, or digit-prefix venue names).
