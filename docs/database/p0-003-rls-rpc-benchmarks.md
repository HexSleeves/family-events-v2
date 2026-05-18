# P0-003 RLS/RPC Benchmarks

## Scope

P0-003 covers repeatable `EXPLAIN (ANALYZE, BUFFERS)` baselines for the highest-traffic Supabase query paths:

- `events_enriched` authenticated city/date list RPC
- `search_events` authenticated filtered list RPC
- `plan_events_first_nonempty_window` scoring RPC
- `plan_events_for_user` candidate selection with and without a selected city
- `public_events` anon city/date view
- anon `comments` and `event_tags` RLS-heavy event-detail paths

## Artifacts

- Script: `supabase/benchmarks/p0_003_rls_rpc_benchmarks.sql`
- Before plan: `supabase/benchmarks/artifacts/p0-003-before.txt`
- After plan: `supabase/benchmarks/artifacts/p0-003-after.txt`
- Migration: `supabase/migrations/20260601002800_p0_003_rls_rpc_query_indexes.sql`

## Runbook

```bash
DB_URL="$(supabase status --output env | awk -F'"' '/^DB_URL=/{print $2}')"
psql "$DB_URL" -v benchmark_label=before -f supabase/benchmarks/p0_003_rls_rpc_benchmarks.sql \
  > supabase/benchmarks/artifacts/p0-003-before.txt
psql "$DB_URL" -f supabase/migrations/20260601002800_p0_003_rls_rpc_query_indexes.sql
psql "$DB_URL" -v benchmark_label=after -f supabase/benchmarks/p0_003_rls_rpc_benchmarks.sql \
  > supabase/benchmarks/artifacts/p0-003-after.txt
```

The benchmark script opens a transaction, inserts synthetic rows, runs `ANALYZE`, captures plans, and rolls back.

## Index/Policy Change List

Added:

- `events_published_city_start_datetime_idx` on `(city_id, start_datetime) where status = 'published'`
- `comments_approved_event_created_at_idx` on `(event_id, created_at desc) where is_approved = true`

No policy changes were required. The existing RLS policies already wrap `auth.uid()` and access-check helpers in scalar subqueries where those helpers would otherwise run per row.

## Captured Local Plan Deltas

| Path | Before | After |
| --- | --- | --- |
| `events_enriched` representative body | `events_city_id_start_datetime_idx`; 50 rows in 1.132 ms | `events_published_city_start_datetime_idx`; 50 rows in 1.071 ms |
| `search_events` representative body | bitmap-and of `events_city_id_idx` + `events_status_start_datetime_idx`; 9,600 + 3,497 index rows touched | `events_published_city_start_datetime_idx`; 2,802 index rows touched |
| `plan_events_for_user` candidate scan with city | `events_city_id_idx`; 9,600 index rows touched | `events_published_city_start_datetime_idx`; 8,228 index rows touched |
| `public_events` city/date view | `events_city_id_start_datetime_idx`; 0.045 ms | `events_published_city_start_datetime_idx`; 0.064 ms |
| approved comments by event | `comments_event_id_idx`; explicit sort | `comments_approved_event_created_at_idx`; no extra sort |

Local execution times are from a synthetic 12,000-row transaction and are kept as artifacts rather than treated as production SLOs. The actionable deltas are the reduced index rows and removal of the comments sort under the same benchmark dataset.
