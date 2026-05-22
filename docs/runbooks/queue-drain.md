# Queue Drain Runbook

## Symptoms

- Event tagging stops for hours
- Source scraping queue grows without processing
- Admin dashboard shows rising `pending` or `dead` counts

## Dashboard queries

Run `public.admin_db_health_snapshot()` as authenticated admin via Supabase dashboard:

```sql
SELECT public.admin_db_health_snapshot();
```

Or check directly:

```sql
SELECT * FROM public.event_tag_queue_summary;
SELECT * FROM public.source_scrape_queue_summary;
```

## Retry dead/failed rows

Use the admin retry RPCs (check supabase dashboard for exact names):

```sql
-- Tag queue retry (admin only)
SELECT public.admin_retry_tag_queue_dead();

-- Source queue retry
SELECT public.admin_retry_source_scrape_queue_dead();
```

## Stuck running rows

```sql
-- Find stuck source runs
SELECT id, source_id, started_at, status
FROM public.source_runs
WHERE status = 'running' AND started_at < now() - interval '15 minutes';

-- Mark as error
UPDATE public.source_runs SET status = 'error', error_log = 'stuck: manually marked'
WHERE status = 'running' AND started_at < now() - interval '15 minutes';
```
