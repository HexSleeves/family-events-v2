# Supabase Backend Deployment Improvement Plan

This is a durable handoff document capturing shipped work and remaining roadmap. All new migrations are additive; no production deploy occurs without explicit user request.

## Already Shipped (DONE)

### Migration 20260601006800: Security & Performance Hardening

**Database schema:**
- Admin-check + revokes on cron read wrappers
- Service-role-only cron logging
- Private cron/trigger/search-vector execute revokes
- Default function privilege tightening for new public functions
- New feed/admin/source/queue/audit indexes (plain, not CONCURRENTLY)
- NOT VALID integrity constraints on events/user_profiles/invite_codes/event_sources
- Rewritten `public.search_events` using `events.search_vector` + `websearch_to_tsquery` with short-keyword ILIKE fallback
- New `public.due_event_sources` RPC

### Migration 20260601006900: Railway Cron Toggle

**Database:**
- `private.cron_enabled` table + seed for 4 cron labels
- `public.is_cron_enabled(label)` — service_role only
- `public.admin_set_cron_enabled(label, enabled)` — admin-only toggle
- `admin_list_railway_cron_jobs` now returns `enabled` boolean

### Edge Functions Hardening

**Files changed:**
- `supabase/functions/_shared/auth.ts`: role + enabled + non-expired checks
- `supabase/functions/notify-email/index.ts`: payload validation
- `supabase/functions/scrape-source/index.ts`: due-source filtering moved to SQL/RPC
- `supabase/functions/process-source-queue/index.ts`: claims one row per invocation

### Deploy Script & CI

**Files:**
- `scripts/deploy.sh`: noninteractive --all, Supabase migration preflights, function-list drift detection
- CI: dump rejection + DB SQL tests
- New SQL tests: `cron_rpc_security.sql`, `search_events_full_text.sql`, `cron_toggle.sql`
- Generated types updated for `due_event_sources`

---

## Remaining Roadmap

### §2 — Cursor-Paginated Feed/Search v2 RPCs

**Migration:** `supabase/migrations/20260601007000_cursor_events_rpcs.sql`

**RPC additions:**
- `public.events_enriched_v2(p_city_id, p_status, p_user_id, p_event_ids, p_date_from, p_date_to, p_after_start_datetime, p_after_id, p_limit)` — cursor on `(start_datetime, id)`, same enrichment as v1
- `public.search_events_v2(...)` — same filters as v1 + cursor params

**Indexes:**
- `events_published_start_id_idx` on `(status, start_datetime, id)`
- `events_published_city_start_id_idx` on `(city_id, start_datetime, id) WHERE status='published'`

**Tests:** `supabase/tests/events_cursor_pagination.sql`

**Risk:** Ties on `start_datetime` are real; composite `(start_datetime, id)` cursor is necessary. Tests prove no duplicates/skips.

---

### §3 — Admin Events Pagination RPC

**Migration:** `supabase/migrations/20260601007100_admin_events_enriched.sql`

**RPC additions:**
- `private.admin_events_enriched(...)` — SECURITY DEFINER, admin check, returns event rows + `total_count` via window function, cursor on `(created_at, id) DESC`
- `public.admin_events_enriched(...)` — SECURITY INVOKER wrapper, authenticated only

**Frontend update:**
- `apps/web/src/features/admin/hooks/use-admin-events.ts` to use RPC

**Tests:** `supabase/tests/admin_events_rpc.sql`

**Risk:** `total_count` via window function is O(n) on filtered rows. Acceptable at current admin event counts <10k; revisit at 100k+.

---

### §4 — Frontend Data-Access Consolidation

**New wrapper modules:** `apps/web/src/lib/db/`
- `client.ts`, `errors.ts` (mapSupabaseError), `rpc-events.ts`, `rpc-admin-events.ts`

**Migrate hooks:**
- `use-events.ts`, `use-enriched-events.ts`, `use-admin-events.ts` to use typed wrappers

---

### §5 — Permissions Cleanup (Measure First)

**Tests:** `supabase/tests/role_smoke.sql` — exercise anon/authenticated/service_role paths for high-traffic tables + representative RPCs

**Migrations:**
- `20260601007200_revoke_default_public_function_grants.sql`
- `20260601007300_tighten_private_schema_usage.sql`

**Risk:** High regression potential. `role_smoke.sql` is the only safe way to do this without staging.

---

### §6 — Observability & Runbooks

**Migration:** `supabase/migrations/20260601007400_admin_db_health.sql`

**RPC:**
- `public.admin_db_health_snapshot()` — JSONB with queue stats, cron run summary, stuck-running counts

**Tests:** `supabase/tests/admin_db_health.sql`

**Runbooks:** Create in `docs/runbooks/`
- `queue-drain.md`
- `cron-logging-failure.md`
- `failed-migration-rollback-forward.md`
- `auth-email-hook-failure.md`
- `railway-deploy-failure.md`

---

### §7 — Trace Retention

**Migration:** `supabase/migrations/20260601007500_trace_retention.sql`

**Change:**
- `CREATE OR REPLACE FUNCTION private.run_daily_maintenance()` adding 90-day DELETE for `event_ai_traces` and `source_extraction_traces`

**Tests:** `supabase/tests/trace_retention.sql`

**Note:** 90 days is conservative; bump if product needs longer AI debugging history.

---

### §8 — Deploy Hardening Follow-Through

**Edit:** `scripts/deploy.sh`

**Changes:**
- Poll `railway status --service $service --json` via jq for `latestDeployment.status` to await BUILDING/DEPLOYING complete
- Post-deploy smoke checks gated behind `DEPLOY_SMOKE=1`: function drift check, synthetic `is_cron_enabled` call, `admin_db_health_snapshot()` call

**Risk:** Depends on `railway status --json` output shape. Verify with manual run before committing jq path.

---

### §9 — Production Query/Stat Evidence Helper

**New file:** `scripts/db/collect-db-evidence.sql` (read-only)
- `pg_stat_statements` top-50
- `pg_stat_user_indexes`, `pg_stat_user_tables`, index sizes
- EXPLAIN templates for key functions
- NOT VALID constraint pre-validation queries

**New file:** `scripts/db/README.md`

---

### §10 — Migration/Index Production Safety

**New file:** `docs/runbooks/database-migrations.md`

**Topics:**
- Index locking assumptions (plain CREATE INDEX acceptable at current scale)
- CONCURRENTLY guidance for >1M rows
- NOT VALID constraint pre-validation queries
- Generated types single-source-of-truth change documentation

**Note:** Deliberately keeping plain CREATE INDEX; revisit if production EXPLAIN shows lock contention.

---

### §11 — Generated Types Consolidation

**Change:** Collapse `apps/web/src/lib/database.types.ts` to re-export from `@family-events/contracts`

---

## Production Rollout Notes

- All new migrations are additive (CREATE OR REPLACE, IF NOT EXISTS, new RPC names, no destructive ALTERs)
- v1 RPCs stay intact; v2 callers are opt-in
- The `run_daily_maintenance` body change (§7) is the only mutating-baseline edit; it's `CREATE OR REPLACE` and idempotent
- No production deploy will be performed as part of this pass; user must explicitly request `scripts/deploy.sh` or Railway push

---

## Validation Checklist

Run from repo root with local Supabase up (`pnpm db:start`):

```bash
# Lint & syntax
git diff --check && git diff --cached --check
bash -n scripts/deploy.sh
jq . infra/spacelift-railway-cron-poc/cron-services.json
jq . tests/fixtures/railway-cron-poc-live.json
node --test tests/railway-cron-poc.test.mjs

# Deno type check (changed function files)
deno check --config supabase/functions/deno.json \
  supabase/functions/_shared/auth.ts \
  supabase/functions/notify-email/index.ts \
  supabase/functions/scrape-source/index.ts \
  supabase/functions/process-source-queue/index.ts

# Deno tests
deno test --config supabase/functions/deno.json \
  supabase/functions/_shared/auth_test.ts \
  supabase/functions/process-tag-queue/queue-policy_test.ts \
  supabase/functions/share-og/index_test.ts

# Full SQL suite
LOCAL_DB_URL="postgresql://postgres:postgres@127.0.0.1:55322/postgres"
psql "$LOCAL_DB_URL" -f supabase/tests/rls_anon_read.sql
psql "$LOCAL_DB_URL" -f supabase/tests/rls_public_events_view.sql
psql "$LOCAL_DB_URL" -f supabase/tests/rls_access_expiry.sql
psql "$LOCAL_DB_URL" -f supabase/tests/rls_privilege_escalation.sql
psql "$LOCAL_DB_URL" -f supabase/tests/cron_rpc_security.sql
psql "$LOCAL_DB_URL" -f supabase/tests/cron_toggle.sql
psql "$LOCAL_DB_URL" -f supabase/tests/search_events_full_text.sql
psql "$LOCAL_DB_URL" -f supabase/tests/events_enriched_parity.sql
psql "$LOCAL_DB_URL" -f supabase/tests/events_cursor_pagination.sql
psql "$LOCAL_DB_URL" -f supabase/tests/admin_events_rpc.sql
psql "$LOCAL_DB_URL" -f supabase/tests/role_smoke.sql
psql "$LOCAL_DB_URL" -f supabase/tests/admin_db_health.sql
psql "$LOCAL_DB_URL" -f supabase/tests/trace_retention.sql
psql "$LOCAL_DB_URL" -f supabase/tests/reference_data.sql

# Web + workspace
pnpm --filter @family-events/web check
pnpm run workspace:test
pnpm run docs:test
pnpm --filter @family-events/web build
```

**Update CI:** Add to `.github/workflows/ci.yml` test loop:
- `supabase/tests/events_cursor_pagination.sql`
- `supabase/tests/admin_events_rpc.sql`
- `supabase/tests/role_smoke.sql`
- `supabase/tests/admin_db_health.sql`
- `supabase/tests/trace_retention.sql`
- `supabase/tests/reference_data.sql`

---

## Risk Summary

| Item | Risk | Mitigation |
|------|------|-----------|
| Cursor RPCs (§2) | Ties on `start_datetime` | Composite `(start_datetime, id)` cursor; tests prove correctness |
| Admin pagination (§3) | `total_count` O(n) cost | Acceptable <10k rows; revisit at 100k+ |
| Permissions tightening (§5) | Regression potential | `role_smoke.sql` validation first; high-regression risk |
| Deploy polling (§8) | jq path drift | Verify `railway status --json` output manually first |
| Trace retention (§7) | 90-day window | Conservative; bump if needed for debugging history |

---

## Summary

11 planned sections cover cursor pagination, admin views, data-access consolidation, permission cleanup, observability, trace retention, deploy hardening, evidence collection, migration safety, and type system consolidation. All migrations are additive. Validation is thorough; no production action without explicit user request.
