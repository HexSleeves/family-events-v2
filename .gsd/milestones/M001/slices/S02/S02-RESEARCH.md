# S02: Geocoding Heuristic Improvement — Research

**Date:** 2026-05-26

## Summary

The geocoding enrichment pipeline uses `list_events_needing_enrichment` (defined in `private` schema, proxied by `public`) to claim events that need coordinates. The heuristic has evolved across two migrations: **009600** introduced the initial geocodable-address filter (street number prefix or street-type word like St/Ave/Blvd), filtering out ~1180 libcal room-label rows that Nominatim could never resolve. **009700** widened the heuristic to also accept place-type words (Park, Museum, Library, Center, Stadium, etc.) in either `address` or `venue_name`, adding ~50-80 Lafayette events to the eligible pool.

The current `_has_geocodable_address` predicate covers: (a) street-number prefix `^\d+\s`, (b) street-type words in address, (c) place-type words in address or venue_name. The pattern is well-established and easy to extend. The next migration follows exactly the same structure: `DROP FUNCTION IF EXISTS`, `CREATE OR REPLACE FUNCTION` for both `private` and `public` schemas, wrapped in `BEGIN/COMMIT`, with updated SQL comment explaining the additions. No edge function code changes are needed — the function signature and return type are unchanged.

The `search_events` RPC has **zero callers in `supabase/functions/`** — confirmed by grep (no matches). The only callers were in `apps/web/` (the dead `use-events.ts` hook that S03 will delete). This is the forward intelligence S03 needs to safely drop the RPC.

## Recommendation

Write a new migration (next sequential number after 009707, e.g. `20260601009800_enrichment_geocodable_address_expand_2.sql`) that widens `_has_geocodable_address` with additional address signal patterns. Based on the existing pattern evolution and common event venue types not yet covered:

**New patterns to add** (extend the OR chain in `_has_geocodable_address`):
1. **Suite/unit number patterns**: `e.address ~* '\m(Suite|Ste|Unit|Apt|Floor|Fl|Bldg|Building)\M'` — covers commercial venues like "123 Main St Suite 200" that may be missing the street-type word.
2. **Additional place-type words**: Add terms not in 009700 — `Gym`, `Fitness`, `Studio`, `Kitchen`, `Cafe`, `Restaurant`, `Bar`, `Brewery`, `Winery`, `Club`, `Lodge`, `Pavilion`, `Amphitheater`, `Amphitheatre`, `Pool`, `Recreation`, `Rec` — common family event venue types in Lafayette.
3. **Venue name with street address pattern**: `e.venue_name ~ '^\d+\s'` — some sources put the street address in `venue_name` rather than `address`.

Also add the required diagnostic query as a comment block in the migration (per R006), showing the centroid-stuck predicate count before and after.

## Implementation Landscape

### Key Files

- `supabase/migrations/20260601009700_enrichment_geocodable_address_expand.sql` — The template to follow exactly. Same function signatures, same RETURNS TABLE, same `DROP FUNCTION IF EXISTS` + `CREATE OR REPLACE` pattern for both `private` and `public` schemas. Same REVOKE/GRANT pattern at end. Same `BEGIN/COMMIT` wrapper. Just update the `_has_geocodable_address` OR chain in the CTE.
- `supabase/migrations/20260601009600_enrichment_geocodable_address_filter.sql` — Historical context. Original filter migration.
- `supabase/functions/backfill-event-enrichment/index.ts` — Read-only reference. No changes needed. Confirms the function signature and behavior.
- **NEW FILE**: `supabase/migrations/20260601009800_enrichment_geocodable_address_expand_2.sql` — The migration to create.

### Build Order

1. **Write the migration** — copy the 009700 migration structure verbatim; update only the `_has_geocodable_address` OR chain with new patterns; update the SQL comment explaining additions; add diagnostic query comment.
2. **Run `supabase db reset` locally** — confirms the migration applies cleanly with no syntax errors.
3. **Run diagnostic SQL** before reset (capture count) and after (confirm count changes on seed data). The diagnostic query:
   ```sql
   SELECT COUNT(*) AS centroid_stuck
   FROM public.events e
   JOIN public.cities c ON c.id = e.city_id
   WHERE (e.latitude IS NULL OR e.longitude IS NULL
     OR (abs(e.latitude - c.latitude) < 0.000001 AND abs(e.longitude - c.longitude) < 0.000001))
     AND NOT 'latitude' = ANY(e.admin_locked_fields)
     AND NOT 'longitude' = ANY(e.admin_locked_fields);
   ```
   And for eligible-after-heuristic count:
   ```sql
   SELECT COUNT(*) AS newly_eligible
   FROM public.events e
   JOIN public.cities c ON c.id = e.city_id
   WHERE (e.latitude IS NULL OR e.longitude IS NULL
     OR (abs(e.latitude - c.latitude) < 0.000001 AND abs(e.longitude - c.longitude) < 0.000001))
     AND NOT 'latitude' = ANY(e.admin_locked_fields)
     AND NOT 'longitude' = ANY(e.admin_locked_fields)
     AND (
       e.address ~ '^\d+\s'
       OR e.address ~* '\m(St|Ave|Blvd|Rd|Dr|Hwy|Pkwy|Way|Ln|Lane|Court|Place|Highway|Parkway|Avenue|Street|Drive|Road|Circle|Cir)\M'
       OR e.address ~* '\m(Park|Museum|Library|Center|Centre|Stadium|Field|Gardens|Garden|Hall|Theater|Theatre|Church|School|University|College|Mall|Plaza|Market|Arena|Cathedral|Zoo|Aquarium|Observatory)\M'
       OR e.venue_name ~* '\m(Park|Museum|Library|Center|Centre|Stadium|Field|Gardens|Garden|Hall|Theater|Theatre|Church|School|University|College|Mall|Plaza|Market|Arena|Cathedral|Zoo|Aquarium|Observatory)\M'
       -- NEW patterns from this migration:
       OR e.address ~* '\m(Gym|Fitness|Studio|Kitchen|Cafe|Restaurant|Bar|Brewery|Winery|Club|Lodge|Pavilion|Amphitheater|Amphitheatre|Pool|Recreation|Rec)\M'
       OR e.venue_name ~* '\m(Gym|Fitness|Studio|Kitchen|Cafe|Restaurant|Bar|Brewery|Winery|Club|Lodge|Pavilion|Amphitheater|Amphitheatre|Pool|Recreation|Rec)\M'
       OR e.venue_name ~ '^\d+\s'
     );
   ```

### Verification Approach

- `supabase db reset` passes with exit code 0
- Diagnostic SQL run on local seed data shows `newly_eligible` count is higher than with just 009700 patterns
- Migration comment clearly explains what was added and why
- `supabase db diff` shows only the expected function replacement, no table changes

## Constraints

- Migration must be `BEGIN/COMMIT` wrapped — idempotent via `CREATE OR REPLACE FUNCTION` for both `private` and `public` schema functions. `DROP FUNCTION IF EXISTS` before each `CREATE OR REPLACE` is the established pattern.
- Do NOT add city-centroid fallback write-back — the backfill-event-enrichment edge function has an explicit comment warning against this (causes claim-queue starvation by re-flagging rows as `needs_coords`).
- Function signature and RETURNS TABLE must be unchanged from 009700 — both `private.list_events_needing_enrichment(int)` and `public.list_events_needing_enrichment(int)` keep the same signature. The edge function calls the public proxy with no code change needed.
- The `SECURITY DEFINER` / `SECURITY INVOKER` split must be preserved: `private` function is `SECURITY DEFINER`, `public` proxy is `SECURITY INVOKER` delegating to `private`.
- `SET search_path = ''` must be present on both functions (security hardening, present in all prior migrations).

## Common Pitfalls

- **Word-boundary anchors `\m` and `\M`** — PostgreSQL regex uses `\m` (word start) and `\M` (word end) for word boundary matching, not `\b`. The existing patterns use these correctly; new patterns must follow the same form. Do NOT use `\b`.
- **Case-insensitive flag `~*`** — Already used for place-type words; new patterns must also use `~*` not `~` for case-insensitive matching. Street-number prefix uses case-sensitive `~` (correct, since digit prefixes don't need case insensitivity).
- **False positive creep** — Adding too many venue-type words risks re-introducing libcal room labels (e.g., "Library Room" matches Library). This is acceptable per the 009700 migration comment: attempt-timestamp rotation keeps false positives from starving the queue. Don't over-filter to avoid false positives at the cost of missing real venues.
- **Missing `DROP FUNCTION IF EXISTS` for both schemas** — 009700 shows both `DROP FUNCTION IF EXISTS public.list_events_needing_enrichment(int)` and `DROP FUNCTION IF EXISTS private.list_events_needing_enrichment(int)` must be dropped before CREATE OR REPLACE. If only public is dropped, the private function may retain old signature.
- **Forgetting REVOKE/GRANT** — Each new migration must re-apply `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` and `GRANT EXECUTE ... TO service_role` on both functions.

## Open Risks

- Local seed data may have few centroid-stuck events, making the before/after count delta small or zero. The diagnostic is still valid — it confirms the query runs cleanly. A zero-delta on seed data is acceptable if the SQL is correct; production data will show real improvement.
- New venue-type patterns (Cafe, Bar, Brewery) may match libcal event descriptions rather than venue addresses if the libcal source populates `address` with event context. Check a few libcal rows in seed data before finalizing the pattern list.

## Forward Intelligence for S03

**`search_events` edge function caller status:** `rg 'search_events' supabase/functions/` returns **zero matches**. No edge functions call `search_events`. S03 can safely delete or drop the RPC without checking edge functions further. The only callers are in `apps/web/` (the `use-events.ts` hook that S03 removes).
