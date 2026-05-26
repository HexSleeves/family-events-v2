# Database Migrations Runbook

## Index strategy

All indexes in this project use `CREATE INDEX IF NOT EXISTS` (not `CONCURRENTLY`).
This locks writes briefly during creation. Acceptable at current data scale.

**When to switch to CONCURRENTLY:**

- `public.events` or any queue table exceeds ~1M rows
- Production EXPLAIN shows lock contention during migration windows

`CREATE INDEX CONCURRENTLY` cannot be inside a transaction. Use a split migration:

```sql
-- supabase/migrations/TIMESTAMP_add_index_concurrently.sql
-- This migration intentionally has no transaction wrapper.
-- supabase: split (hypothetical Supabase CLI directive - verify current CLI docs)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_name ON table_name (col);
```

Verify the exact `supabase migration` split mechanism in Supabase CLI docs before using.

**Before dropping old indexes:** Check `pg_stat_user_indexes.idx_scan` is zero over a representative window. Do not drop `events_published_city_start_datetime_idx` until the v2 cursor index (`events_published_city_start_id_idx`) has proven itself in production.

## NOT VALID constraints

All integrity constraints added in `20260601001000_reference_security_and_cron.sql` are `NOT VALID`. They enforce on new/updated rows but do not validate existing data.

Before running `VALIDATE CONSTRAINT` migrations, run the pre-validation queries in `scripts/db/collect-db-evidence.sql` (constraint pre-validation section). Each must return 0 violations.

## Generated types — single source of truth

The canonical generated types live in `packages/contracts/src/database.types.ts`.

`apps/web/src/lib/database.types.ts` is a thin re-export wrapper:

```typescript
export * from "@family-events/contracts/database-types"
```

After running `pnpm db:types` (which writes to `packages/contracts/src/database.types.ts`), the web app picks up the new types automatically. No separate copy step needed.

To regenerate types:

```bash
pnpm db:types
# Then verify web compiles:
pnpm --filter @family-events/web check
```

## Private body + public wrapper pattern

All new RPCs with elevated privileges must follow the pattern in CLAUDE.md:

1. `private.<name>` — SECURITY DEFINER, empty search_path, admin check first
2. `public.<name>` — SECURITY INVOKER wrapper
3. Explicit REVOKE/GRANT on both

Reference the existing RPCs in `supabase/migrations/20260601002000_event_ingestion_admin_foundation.sql` and `supabase/migrations/20260601003000_maintenance_and_admin_queues.sql`.

## Migration ordering

Migrations are applied in timestamp order. The current prelaunch sequence:

- `20260601000000_schema_baseline` — baseline schema and guarded pre-baseline cleanup
- `20260601001000_reference_security_and_cron` — reference data, security/performance hardening, cron toggles
- `20260601002000_event_ingestion_admin_foundation` — scrape import, cursor event RPCs, admin event RPCs, trace retention
- `20260601003000_maintenance_and_admin_queues` — maintenance fixes, queue admin RPCs, mutation audit RPCs
- `20260601004000_llm_review_and_enrichment` — LLM review pipeline, enrichment scope, API hardening
- `20260601005000_ai_models_and_cron_drilldown` — AI model configuration and cron run drilldown
- `20260601006000_enrichment_images_and_rpc_cleanup` — geocoding heuristics, parent tips, image attribution, RPC cleanup
