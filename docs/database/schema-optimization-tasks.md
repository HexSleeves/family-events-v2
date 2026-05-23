# Supabase Schema Optimization Tasks

Generated from Supabase MCP inspection of the `public`, `private`, and `storage` schemas. Scope includes tables, columns, keys, constraints, RLS policies, indexes, views, functions, triggers, advisors, and table/index stats.

## Executive Summary

The schema is generally healthy: primary keys are present, most foreign keys are indexed, public tables have RLS enabled, public views use `security_invoker=true`, and queue tables already use partial indexes for claim/dedup flows.

Highest-impact work:

- Add missing covering indexes for LLM review foreign keys.
- Optimize two LLM review RLS policies that call `private.is_admin()` directly.
- Tighten public execution grants around service-only and trigger-only privileged functions.
- Validate existing `NOT VALID` constraints.
- Add timestamp-led indexes for maintenance/retention deletes before trace and attempt tables grow.
- Decide whether to enable RLS on `private` cron tables as defense in depth.

## Task Checklist

- [x] Add missing LLM review foreign-key indexes.
- [x] Wrap LLM review RLS helper calls in `SELECT`.
- [x] Restrict service-only and trigger-only public RPC function execution.
- [x] Convert `public.is_enabled_user()` to an invoker wrapper.
- [x] Convert `public.admin_railway_cron_run_history()` to an invoker wrapper.
- [x] Add retention cleanup indexes.
- [x] Add stale source-run cleanup index.
- [x] Add enrichment backlog index.
- [x] Validate existing `NOT VALID` constraints.
- [x] Add `event_llm_review_queue.trigger_type` check constraint.
- [x] Enable RLS on private cron tables and verify admin/service RPC behavior.
- [x] Re-run Supabase performance and security advisors.
- [x] Run verification queries.
- [x] Observe index usage before dropping low-use indexes. Completed for non-live environment; redundant indexes dropped and conditional candidates retained pending query-path confirmation.

## High-Priority Actions

### Task: Add missing LLM review foreign-key indexes

- Table: `public.event_llm_review_queue`, `public.event_llm_review_traces`
- Current issue: Supabase performance advisor reports unindexed foreign keys on `source_id`, `source_run_id`, and `queue_id`.
- Recommended change: Add partial btree indexes on nullable FK columns.
- Why this matters: Parent-row deletes/updates and joins from source/run/queue views avoid table scans as review volume grows.
- Risk/tradeoff: Extra write cost on insert/update; current risk is low because these tables had 0 rows at inspection time.
- Priority: High
- SQL migration:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS event_llm_review_queue_source_id_idx
ON public.event_llm_review_queue (source_id)
WHERE source_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS event_llm_review_queue_source_run_id_idx
ON public.event_llm_review_queue (source_run_id)
WHERE source_run_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS event_llm_review_traces_queue_id_idx
ON public.event_llm_review_traces (queue_id)
WHERE queue_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS event_llm_review_traces_source_id_idx
ON public.event_llm_review_traces (source_id)
WHERE source_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS event_llm_review_traces_source_run_id_idx
ON public.event_llm_review_traces (source_run_id)
WHERE source_run_id IS NOT NULL;
```

### Task: Cache fixed RLS helper calls in LLM review policies

- Table: `public.event_llm_review_queue`, `public.event_llm_review_traces`
- Current issue: These two policies use `private.is_admin()` directly. Most existing policies use `(SELECT private.is_admin())`.
- Recommended change: Alter policies to wrap the helper in `SELECT`.
- Why this matters: Supabase RLS guidance recommends wrapping fixed auth/helper calls so Postgres can evaluate them as an initPlan instead of per row.
- Risk/tradeoff: Safe because `private.is_admin()` does not depend on row data.
- Priority: High
- SQL migration:

```sql
ALTER POLICY "Admins can read event llm review queue"
ON public.event_llm_review_queue
USING ((SELECT private.is_admin()));

ALTER POLICY "Admins can read event llm review traces"
ON public.event_llm_review_traces
USING ((SELECT private.is_admin()));
```

### Task: Restrict service-only public RPC functions

- Table: Functions in `public`
- Current issue: Security advisor reports public `SECURITY DEFINER` functions executable by `anon` and/or `authenticated`. Several are cron/worker entrypoints or triggers and should not be browser-callable.
- Recommended change: Revoke execution from `PUBLIC`, `anon`, and `authenticated` for service-only or trigger-only functions.
- Why this matters: Reduces exposed privileged RPC surface.
- Risk/tradeoff: Confirm the web app does not call these directly. Trigger functions continue to run from triggers after execute revocation.
- Priority: High
- SQL migration:

```sql
REVOKE EXECUTE ON FUNCTION public.handle_new_user()
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.prevent_role_change()
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.reset_comment_approval_for_non_admin()
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.invoke_process_tag_queue()
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.invoke_scrape_source(uuid)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.run_due_source_scrapes()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.invoke_process_tag_queue() TO service_role;
GRANT EXECUTE ON FUNCTION public.invoke_scrape_source(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.run_due_source_scrapes() TO service_role;
```

### Task: Convert `public.is_enabled_user()` to an invoker wrapper

- Table: Function `public.is_enabled_user()`
- Current issue: It is a public-schema `SECURITY DEFINER` function executable by `anon`, `authenticated`, and `service_role`.
- Recommended change: Keep the public RPC shape, but make it a `SECURITY INVOKER` wrapper around the private helper.
- Why this matters: Preserves intended client behavior while removing public `SECURITY DEFINER` exposure.
- Risk/tradeoff: Depends on existing `private.has_enabled_access()` grants and `private` schema usage grants. Verify as `anon` and `authenticated`.
- Priority: High
- SQL migration:

```sql
CREATE OR REPLACE FUNCTION public.is_enabled_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
  SELECT private.has_enabled_access();
$$;

REVOKE EXECUTE ON FUNCTION public.is_enabled_user()
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_enabled_user()
TO anon, authenticated, service_role;
```

### Task: Convert `public.admin_railway_cron_run_history()` to an invoker wrapper

- Table: Function `public.admin_railway_cron_run_history(text, integer)`
- Current issue: It is a public-schema `SECURITY DEFINER` function. The repo convention is private body plus public invoker wrapper.
- Recommended change: Replace the public function with a `SECURITY INVOKER` wrapper that delegates to `private.railway_cron_run_history`.
- Why this matters: Keeps admin UI access through an authenticated RPC while removing public-schema definer execution.
- Risk/tradeoff: Requires `authenticated` to have execute on the private body and usage on `private`.
- Priority: High
- SQL migration:

```sql
CREATE OR REPLACE FUNCTION public.admin_railway_cron_run_history(
  p_label text DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS TABLE(
  id bigint,
  label text,
  status text,
  http_status integer,
  duration_s integer,
  body text,
  ran_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
  SELECT *
  FROM private.railway_cron_run_history(p_label, p_limit);
$$;

REVOKE EXECUTE ON FUNCTION public.admin_railway_cron_run_history(text, integer)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_railway_cron_run_history(text, integer)
TO authenticated, service_role;
```

## Recommended Schema Changes

### Task: Add retention cleanup indexes

- Table: `public.invite_request_attempts`, `public.invite_redemption_attempts`, `public.recommendation_signals`, `public.event_ai_traces`, `public.source_extraction_traces`
- Current issue: `private.run_daily_maintenance()` deletes old rows by `attempted_at` or `created_at`, but existing indexes are either absent or led by another column.
- Recommended change: Add timestamp-led indexes for retention predicates.
- Why this matters: Keeps daily cleanup from becoming sequential-scan-heavy as operational tables grow.
- Risk/tradeoff: Additional write cost. Current risk is low because most affected tables are small or empty.
- Priority: Medium
- SQL migration:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS invite_request_attempts_attempted_at_idx
ON public.invite_request_attempts (attempted_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS invite_redemption_attempts_attempted_at_idx
ON public.invite_redemption_attempts (attempted_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS recommendation_signals_created_at_idx
ON public.recommendation_signals (created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS event_ai_traces_created_at_idx
ON public.event_ai_traces (created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS source_extraction_traces_created_at_idx
ON public.source_extraction_traces (created_at);
```

### Task: Add stale source-run cleanup index

- Table: `public.source_runs`
- Current issue: `private.cleanup_stale_source_runs()` filters `status = 'running'` and `started_at < now() - interval '15 minutes'`; current index coverage is for source/error history, not running cleanup.
- Recommended change: Add a partial index for running rows by `started_at`.
- Why this matters: Prevents stale-run cleanup from scanning all historical runs.
- Risk/tradeoff: Very low write overhead because only `running` rows enter this partial index.
- Priority: Medium
- SQL migration:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS source_runs_running_started_idx
ON public.source_runs (started_at)
WHERE status = 'running';
```

### Task: Add enrichment backlog index

- Table: `public.events`
- Current issue: `private.list_events_needing_enrichment()` filters for missing coordinates/images and orders by `created_at DESC`.
- Recommended change: Add a partial index for events likely to need enrichment.
- Why this matters: Keeps enrichment workers from scanning the whole event table as event volume grows.
- Risk/tradeoff: The partial predicate cannot encode every `admin_locked_fields` exclusion efficiently, so some indexed rows may still be filtered after index lookup.
- Priority: Medium
- SQL migration:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS events_needing_enrichment_created_idx
ON public.events (created_at DESC, id)
WHERE (
  latitude IS NULL
  OR longitude IS NULL
  OR images = '[]'::jsonb
  OR jsonb_array_length(images) = 0
);
```

### Task: Validate existing `NOT VALID` constraints

- Table: `public.events`, `public.event_sources`, `public.invite_codes`, `public.user_profiles`
- Current issue: 6 integrity constraints exist but are not validated.
- Recommended change: Validate them.
- Why this matters: Converts intended rules into fully trusted constraints for existing data and planner assumptions.
- Risk/tradeoff: Validation scans each table and fails if legacy rows violate the constraint. Run during low traffic.
- Priority: High
- SQL migration:

```sql
ALTER TABLE public.event_sources
VALIDATE CONSTRAINT event_sources_scrape_interval_chk;

ALTER TABLE public.events
VALIDATE CONSTRAINT events_age_range_chk;

ALTER TABLE public.events
VALIDATE CONSTRAINT events_lat_lng_chk;

ALTER TABLE public.events
VALIDATE CONSTRAINT events_price_chk;

ALTER TABLE public.invite_codes
VALIDATE CONSTRAINT invite_codes_used_count_max_chk;

ALTER TABLE public.user_profiles
VALIDATE CONSTRAINT user_profiles_child_age_chk;
```

### Task: Add trigger type check to LLM review queue

- Table: `public.event_llm_review_queue`
- Current issue: `trigger_type` is unconstrained `text`, unlike `event_tag_queue.trigger_type`.
- Recommended change: Add a check constraint matching the existing event tag queue trigger vocabulary.
- Why this matters: Prevents invalid queue provenance values and keeps operational filters predictable.
- Risk/tradeoff: Future trigger types require constraint updates.
- Priority: Medium
- SQL migration:

```sql
ALTER TABLE public.event_llm_review_queue
ADD CONSTRAINT event_llm_review_queue_trigger_type_check
CHECK (trigger_type = ANY (ARRAY['import', 'reclassify', 'manual-review']))
NOT VALID;

ALTER TABLE public.event_llm_review_queue
VALIDATE CONSTRAINT event_llm_review_queue_trigger_type_check;
```

### Task: Enable RLS on private cron tables or document exception

- Table: `private.railway_cron_runs`, `private.cron_enabled`
- Current issue: Supabase table inspection returned a critical advisory for RLS disabled on both private tables.
- Recommended change: Enable RLS and rely on existing `SECURITY DEFINER` RPCs for access.
- Why this matters: Defense in depth if schema grants drift.
- Risk/tradeoff: Enabling RLS without policies blocks direct role access. Test admin cron UI after applying.
- Priority: Medium
- SQL migration:

```sql
ALTER TABLE private.railway_cron_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.cron_enabled ENABLE ROW LEVEL SECURITY;
```

## Index Recommendations

### Indexes to Add

```sql
-- High: missing FK coverage
CREATE INDEX CONCURRENTLY IF NOT EXISTS event_llm_review_queue_source_id_idx
ON public.event_llm_review_queue (source_id)
WHERE source_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS event_llm_review_queue_source_run_id_idx
ON public.event_llm_review_queue (source_run_id)
WHERE source_run_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS event_llm_review_traces_queue_id_idx
ON public.event_llm_review_traces (queue_id)
WHERE queue_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS event_llm_review_traces_source_id_idx
ON public.event_llm_review_traces (source_id)
WHERE source_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS event_llm_review_traces_source_run_id_idx
ON public.event_llm_review_traces (source_run_id)
WHERE source_run_id IS NOT NULL;

-- Medium: retention and maintenance
CREATE INDEX CONCURRENTLY IF NOT EXISTS invite_request_attempts_attempted_at_idx
ON public.invite_request_attempts (attempted_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS invite_redemption_attempts_attempted_at_idx
ON public.invite_redemption_attempts (attempted_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS recommendation_signals_created_at_idx
ON public.recommendation_signals (created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS event_ai_traces_created_at_idx
ON public.event_ai_traces (created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS source_extraction_traces_created_at_idx
ON public.source_extraction_traces (created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS source_runs_running_started_idx
ON public.source_runs (started_at)
WHERE status = 'running';

CREATE INDEX CONCURRENTLY IF NOT EXISTS events_needing_enrichment_created_idx
ON public.events (created_at DESC, id)
WHERE (
  latitude IS NULL
  OR longitude IS NULL
  OR images = '[]'::jsonb
  OR jsonb_array_length(images) = 0
);
```

### Indexes to Remove

Do not drop solely because Supabase reports `idx_scan = 0`; this project has new tables, small row counts, and admin paths that may not have had representative traffic yet.

Safe drop candidates after another production observation window:

```sql
-- Redundant: same predicate and leading columns are covered by events_published_feed_idx.
DROP INDEX CONCURRENTLY IF EXISTS public.events_published_city_start_datetime_idx;

-- Redundant: covered by recommendation_signals_user_created_idx for user_id lookups.
DROP INDEX CONCURRENTLY IF EXISTS public.recommendation_signals_user_id_idx;

-- Redundant: covered by user_calendar_events_user_id_event_id_key for user_id lookups.
DROP INDEX CONCURRENTLY IF EXISTS public.user_calendar_events_user_id_idx;
```

Potential drop candidates only after confirming no matching admin/product query path:

```sql
DROP INDEX CONCURRENTLY IF EXISTS public.events_is_featured_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_events_ai_tag_provider;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_events_ai_tag_status;
DROP INDEX CONCURRENTLY IF EXISTS public.event_sources_processing_mode_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.admin_audit_log_metadata_idx;
```

Indexes to keep despite low usage:

- `event_tags_tag_id_idx`: covers FK from `event_tags.tag_id` to `tags.id`.
- `events_search_vector_idx`: required for `search_events`, `search_events_v2`, and admin keyword search.
- FK indexes on empty social tables: useful once `favorites`, `ratings`, `comments`, and calendar rows exist.

### Indexes to Modify or Replace

Replace `events_published_city_start_datetime_idx` with existing `events_published_feed_idx`; no new index needed because the latter covers `(city_id, start_datetime, id)` with the same `status = 'published'` predicate.

Optional replacement if featured events become real data:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS events_featured_published_start_idx
ON public.events (start_datetime, id)
WHERE status = 'published'
  AND is_featured = true;

DROP INDEX CONCURRENTLY IF EXISTS public.events_is_featured_idx;
```

## RLS and Security Performance Review

Good patterns already present:

- Most policies use role-specific `TO` scopes.
- Most auth helper calls are wrapped as `(SELECT auth.uid())`, `(SELECT private.is_admin())`, or `(SELECT private.has_enabled_access())`.
- Public views use `security_invoker=true`.

Issues to address:

- `event_llm_review_queue` and `event_llm_review_traces` policies call `private.is_admin()` directly. Fix with the `ALTER POLICY` statements above.
- Several public `SECURITY DEFINER` functions are executable by public browser roles. Revoke or convert wrappers as listed above.
- `pg_graphql` security advisor reports many public objects visible to `anon` and `authenticated`.
- `private.railway_cron_runs` and `private.cron_enabled` have RLS disabled.

If GraphQL is unused, consider:

```sql
DROP EXTENSION IF EXISTS pg_graphql;
```

Risk: this disables Supabase GraphQL API support. If GraphQL is used, do not drop it; selectively revoke `SELECT` on sensitive objects after checking REST/PostgREST dependencies.

## Data Integrity Review

Recommended integrity work:

- Validate all existing `NOT VALID` constraints.
- Add `event_llm_review_queue_trigger_type_check`.
- Keep existing uniqueness constraints on user-event tables:
  - `favorites(user_id, event_id)`
  - `ratings(user_id, event_id)`
  - `user_calendar_events(user_id, event_id)`
- Keep existing partial uniqueness on active queues:
  - `event_tag_queue_event_active_uniq`
  - `source_scrape_queue_source_active_uniq`
  - `event_llm_review_queue_active_event_idx`

Potential future improvement, not immediate:

- `events.latitude` and `events.longitude` are `numeric`; distance code casts into earth-distance functions. `double precision` would be cheaper for geospatial scoring, but changing existing columns is invasive and not justified by current row counts.

## Migration Order

1. Validate data before adding more assumptions.
2. Add new indexes in separate non-transactional migration steps if the migration runner supports `CONCURRENTLY`.
3. Alter RLS policies for LLM review tables.
4. Revoke/convert public `SECURITY DEFINER` function access.
5. Add `event_llm_review_queue_trigger_type_check`.
6. Enable RLS on private cron tables and test admin cron UI/RPCs.
7. Re-run advisors.
8. After 7-14 days of production stats, drop only confirmed redundant indexes.

## Verification Queries

### Confirm missing FK indexes are fixed

```sql
WITH fk AS (
  SELECT
    con.oid,
    con.conname,
    con.conrelid,
    con.conkey::int[] AS conkey
  FROM pg_constraint con
  WHERE con.contype = 'f'
    AND con.connamespace = 'public'::regnamespace
),
idx AS (
  SELECT
    i.indrelid,
    i.indkey::int[] AS indkey,
    c.relname AS index_name,
    i.indisvalid
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indexrelid
)
SELECT
  conrelid::regclass AS table_name,
  conname AS fk_name,
  EXISTS (
    SELECT 1
    FROM idx
    WHERE idx.indrelid = fk.conrelid
      AND idx.indisvalid
      AND idx.indkey[0:cardinality(fk.conkey)-1] = fk.conkey
  ) AS has_covering_index
FROM fk
WHERE conrelid::regclass::text IN (
  'event_llm_review_queue',
  'event_llm_review_traces'
)
ORDER BY table_name, fk_name;
```

### Confirm constraint validation

```sql
SELECT
  conrelid::regclass AS table_name,
  conname,
  convalidated
FROM pg_constraint
WHERE conname IN (
  'event_sources_scrape_interval_chk',
  'events_age_range_chk',
  'events_lat_lng_chk',
  'events_price_chk',
  'invite_codes_used_count_max_chk',
  'user_profiles_child_age_chk',
  'event_llm_review_queue_trigger_type_check'
)
ORDER BY table_name::text, conname;
```

### Confirm RLS policies use cached helper calls

```sql
SELECT
  schemaname,
  tablename,
  policyname,
  qual
FROM pg_policies
WHERE tablename IN ('event_llm_review_queue', 'event_llm_review_traces')
ORDER BY tablename, policyname;
```

Expected `qual` should include a subquery form equivalent to:

```sql
( SELECT private.is_admin() AS is_admin)
```

### Confirm public definer function exposure is reduced

```sql
SELECT
  n.nspname AS schema,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  p.prosecdef AS security_definer,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'admin_railway_cron_run_history',
    'handle_new_user',
    'invoke_process_tag_queue',
    'invoke_scrape_source',
    'is_enabled_user',
    'prevent_role_change',
    'reset_comment_approval_for_non_admin',
    'run_due_source_scrapes'
  )
ORDER BY p.proname;
```

### Confirm private cron RLS

```sql
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'private'
  AND tablename IN ('railway_cron_runs', 'cron_enabled')
ORDER BY tablename;
```

### Confirm planner uses key indexes

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM public.event_llm_review_queue
WHERE source_id = '00000000-0000-0000-0000-000000000000';

EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM public.event_llm_review_traces
WHERE queue_id = 1;
```

Run destructive verification inside an explicit transaction:

```sql
BEGIN;

EXPLAIN (ANALYZE, BUFFERS)
DELETE FROM public.invite_request_attempts
WHERE attempted_at < now() - interval '30 days';

ROLLBACK;
```

### Re-run Supabase advisors

Use Supabase MCP:

- `get_advisors(type: "performance")`
- `get_advisors(type: "security")`

Expected performance advisor changes:

- No `unindexed_foreign_keys` entries for `event_llm_review_queue`.
- No `unindexed_foreign_keys` entries for `event_llm_review_traces`.

Expected security advisor changes:

- Fewer public `SECURITY DEFINER` executable warnings.
- Private cron RLS warning gone if RLS was enabled.
- GraphQL exposure warnings remain unless GraphQL is disabled or grants are tightened.

## Notes

- `CREATE INDEX CONCURRENTLY` cannot run inside a transaction block. If the migration runner wraps migrations in a transaction, create these indexes without `CONCURRENTLY` during a maintenance window or run the concurrent index creation outside the wrapped migration.
- Do not drop indexes based only on `idx_scan = 0`. Re-check after representative production traffic.
- Storage tables were present but application storage was empty during inspection, so no storage-specific changes are included.
