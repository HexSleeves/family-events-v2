# Failed Migration — Roll Forward Runbook

Supabase Cloud has no automatic migration rollback. The only safe path is forward.

## Recipe
1. Identify which migration failed: check Supabase dashboard → Database → Migrations
2. Write a corrective migration that undoes the damage (drop the bad column, restore data, etc.)
3. Name it with the next available timestamp: `supabase/migrations/YYYYMMDDHHMMSS_fix_<name>.sql`
4. Apply: `supabase db push` or via CI

## Conventions
- All migrations in this project use `BEGIN; ... COMMIT;` (transactional)
- `CREATE INDEX CONCURRENTLY` cannot be inside a transaction — use a split migration
- New RPCs follow the private-body / public-wrapper pattern (see CLAUDE.md)
- `IF NOT EXISTS` guards make most CREATE statements idempotent

## Prevention
Before merging a migration PR:
- Run `psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f <migration_file>` against local DB
- Run the full SQL test suite
- Verify with role-check SQL block from CLAUDE.md
