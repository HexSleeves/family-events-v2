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

All integrity constraints added in `20260601006800_security_performance_hardening.sql` are `NOT VALID`. They enforce on new/updated rows but do not validate existing data.

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

Reference: `supabase/migrations/20260601002100_wrap_security_definer_rpcs.sql`

## Migration ordering

Migrations are applied in timestamp order. The current sequence:

- `20260601000000` — consolidated schema (baseline)
- `20260601006800` — security/performance hardening
- `20260601006900` — railway cron toggle
- `20260601007000` — cursor events RPCs (v2)
- `20260601007100` — admin events enriched RPC
- `20260601007200` — revoke default public function grants
- `20260601007300` — tighten private schema usage
- `20260601007400` — admin db health snapshot RPC
- `20260601007500` — trace retention (run_daily_maintenance extension)
