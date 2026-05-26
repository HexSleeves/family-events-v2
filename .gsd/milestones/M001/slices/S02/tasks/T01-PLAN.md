---
estimated_steps: 18
estimated_files: 1
skills_used: []
---

# T01: Created 009800 migration expanding _has_geocodable_address with 4 new OR clauses (suite/unit, extended place-types in address, extended place-types in venue_name, venue_name street-number prefix) plus embedded diagnostic queries

**Why:** The current `_has_geocodable_address` predicate (009700) covers street numbers, street-type words, and a set of place-type words, but misses suite/unit indicators, family-event venue types (Gym, Cafe, Brewery, Pool, etc.), and venue_name street-address prefixes. Widening the predicate adds more events to the geocoding-eligible pool without re-introducing libcal room-label noise.

**Do:**
1. Create `supabase/migrations/20260601009800_enrichment_geocodable_address_expand_2.sql`.
2. Copy the full structure from `20260601009700_enrichment_geocodable_address_expand.sql` verbatim — `BEGIN/COMMIT` wrapper, `DROP FUNCTION IF EXISTS` for both `private` and `public` schemas, identical `RETURNS TABLE` shape, `SECURITY DEFINER`/`SECURITY INVOKER` split, `SET search_path = ''` on both, `REVOKE/GRANT` block at end.
3. In the `_has_geocodable_address` CTE expression, append four new OR clauses after the existing 009700 lines:
   - `OR e.address ~* '\m(Suite|Ste|Unit|Apt|Floor|Fl|Bldg|Building)\M'` (suite/unit indicators imply a real street address)
   - `OR e.address ~* '\m(Gym|Fitness|Studio|Kitchen|Cafe|Restaurant|Bar|Brewery|Winery|Club|Lodge|Pavilion|Amphitheater|Amphitheatre|Pool|Recreation|Rec)\M'` (extended address place-types)
   - `OR e.venue_name ~* '\m(Gym|Fitness|Studio|Kitchen|Cafe|Restaurant|Bar|Brewery|Winery|Club|Lodge|Pavilion|Amphitheater|Amphitheatre|Pool|Recreation|Rec)\M'` (same terms in venue_name)
   - `OR e.venue_name ~ '^\d+\s'` (venue_name used as street address by some sources)
4. Update the migration header comment to explain what 009800 adds and reference 009700 as the baseline.
5. Add a `-- DIAGNOSTIC QUERY` comment block at the top of the file (after the header, before BEGIN) containing both diagnostic queries from the research — the centroid-stuck count and the newly-eligible count — so R006 is satisfied without running code.

**Constraints:**
- Use `\m`/`\M` PostgreSQL word-boundary anchors, NOT `\b`.
- New place-type OR clauses use `~*` (case-insensitive). Street-number prefix uses `~` (correct as-is).
- `RETURNS TABLE` columns must be identical to 009700 — do not add, remove, or rename columns.
- Do NOT add city-centroid fallback write-back.
- Both `DROP FUNCTION IF EXISTS` statements (private and public) must appear before their respective `CREATE OR REPLACE`.

**Done when:** File exists, `grep` finds all four new pattern groups in the file, and the function signature grep matches 009700.

## Inputs

- `supabase/migrations/20260601009700_enrichment_geocodable_address_expand.sql`
- `supabase/migrations/20260601009600_enrichment_geocodable_address_filter.sql`

## Expected Output

- `supabase/migrations/20260601009800_enrichment_geocodable_address_expand_2.sql`

## Verification

test -f supabase/migrations/20260601009800_enrichment_geocodable_address_expand_2.sql

## Observability Impact

Diagnostic query comment block in migration header serves as the R006 observability artifact — queryable before/after SQL is embedded in the migration itself.
