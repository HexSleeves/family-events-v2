# Railway Deploy Failure Runbook

## Common errors

### Token/auth errors

```
Error: Not authenticated
```

Fix: `railway login` or set `RAILWAY_TOKEN` env var.

### Service not found

```
Error: No service found
```

Fix: Verify `RAILWAY_SERVICE_ID` env var matches the service in Railway dashboard.

### Deployment failed

Check `railway status --service <name>` for `latestDeployment.status`.
Values: `SUCCESS`, `FAILED`, `CRASHED`, `BUILDING`, `DEPLOYING`.

## Manual verification

```bash
# Check all services
railway status

# Trigger manual re-deploy
railway redeploy --service <service-name>

# View logs
railway logs --service <service-name>
```

## Cron services

The 4 cron services are: `cron-tag-queue`, `cron-scrape-sources`, `cron-db-maintenance`, `cron-cleanup-stale`.
Each has a `cron-runner.sh` that checks `public.is_cron_enabled` before running.
If a service crashes, check:

1. `private.railway_cron_runs` for the label's last run status
2. Railway deployment logs for the service
3. `public.is_cron_enabled('<label>')` — if false, toggle on via admin UI
