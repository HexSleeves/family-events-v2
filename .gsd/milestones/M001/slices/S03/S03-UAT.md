# S03: Disable Invite Gate and Production Runbook — UAT

**Milestone:** M001
**Written:** 2026-05-28T06:53:41.324Z

# S03: Disable Invite Gate and Production Runbook — UAT

**Milestone:** M001
**Written:** 2026-05-28

## UAT Type

- UAT mode: artifact-driven
- Why this mode is sufficient: This slice produces a SQL migration and a documentation file — no runtime UI or API changes. Correctness is verified by file content inspection, migration ordering, and confirming existing tests remain green.

## Preconditions

- Repository checked out with all migrations present in `supabase/migrations/`
- Node.js and pnpm available for running web tests
- No Supabase local instance required (contract verification only)

## Smoke Test

Run `grep -q "app.settings.require_invite" supabase/migrations/20260601012000_disable_invite_gate.sql && echo PASS` — confirms the migration file exists with the correct GUC reference.

## Test Cases

### 1. Migration contains correct ALTER DATABASE statement

1. Open `supabase/migrations/20260601012000_disable_invite_gate.sql`
2. Locate the SQL statement
3. **Expected:** File contains exactly `ALTER DATABASE postgres SET app.settings.require_invite = 'false';`

### 2. Migration sorts after schema baseline

1. List `supabase/migrations/*.sql` sorted alphabetically
2. **Expected:** `20260601012000_disable_invite_gate.sql` appears after `20260601000000_schema_baseline.sql`

### 3. Runbook contains all required sections

1. Open `supabase/docs/INVITE_GATE.md`
2. Scan for section headings
3. **Expected:** File contains sections for Disable, Re-enable, Verification, Affected Functions, Local Development, and See Also

### 4. Runbook includes verification query

1. Open `supabase/docs/INVITE_GATE.md`
2. Search for SQL code blocks
3. **Expected:** Contains `SELECT public.invites_required();` as a verification step

### 5. Existing SQL tests unaffected

1. Open `supabase/tests/invite_gate_oauth_signup.sql`
2. Confirm it uses `set_config()` for session-level override
3. **Expected:** Test uses `set_config('app.settings.require_invite', ...)` which overrides any database-level default

### 6. Web tests still pass

1. Run `pnpm run web:test`
2. **Expected:** All 419 tests pass across 43 test files

## Edge Cases

### Migration applied to fresh database

1. Apply all migrations in order to a fresh Supabase instance
2. Run `SELECT public.invites_required();`
3. **Expected:** Returns `false` (gate disabled for local dev)

### Session override still works after migration

1. After migration is applied, run `SELECT set_config('app.settings.require_invite', 'true', true);`
2. Run `SELECT public.invites_required();`
3. **Expected:** Returns `true` — session-level override takes precedence over database default

## Failure Signals

- Migration file missing or contains wrong SQL statement
- Runbook missing required sections (Disable, Re-enable, Verification)
- SQL test file no longer uses session-level `set_config()` 
- Web tests fail after migration is added (would indicate unintended coupling)

## Not Proven By This UAT

- Live Supabase instance behavior — migration not run against a real database in this UAT
- Production Dashboard toggle — runbook documents steps but doesn't execute them
- Admin invites page showing "Disabled" banner — requires running the full app (verified in S02's reactive UI)

## Notes for Tester

- The migration only affects local dev defaults. Production requires manual action via Supabase Dashboard SQL Editor as documented in the runbook.
- Pooled connections may retain old GUC values after `ALTER DATABASE` — the runbook includes a reconnection caveat for this.
