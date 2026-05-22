# Cron Logging Failure Runbook

## What `private.log_railway_cron_run` requires
The edge function `cron-db-maintenance` and cron runners POST to `LOG_CRON_RUN_URL`
(the `db-maintenance` edge function URL). That function calls `private.log_railway_cron_run`
using the `service_role` JWT from `LOG_CRON_RUN_KEY`.

Requirements:
- `LOG_CRON_RUN_URL` env var set on each cron Railway service
- `LOG_CRON_RUN_KEY` is the `service_role` key
- The edge function must be deployed: `supabase functions deploy db-maintenance`

## Diagnosing missing rows
```sql
-- Check recent runs
SELECT * FROM private.railway_cron_runs
ORDER BY ran_at DESC LIMIT 20;

-- Check if a label has never run
SELECT label FROM (VALUES ('cron-tag-queue'),('cron-scrape-sources'),('cron-db-maintenance'),('cron-cleanup-stale')) AS t(label)
WHERE label NOT IN (SELECT DISTINCT label FROM private.railway_cron_runs);
```

## Service_role key rotation
1. Generate new service_role key in Supabase dashboard → Project Settings → API
2. Update `SUPABASE_SERVICE_KEY` in Railway service env vars for all 4 cron services
3. Also update `LOG_CRON_RUN_KEY` env var
4. Verify: trigger a cron run manually and check `private.railway_cron_runs`
