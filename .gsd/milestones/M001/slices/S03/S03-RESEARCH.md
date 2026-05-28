# S03: Disable Invite Gate and Production Runbook — Research

**Date:** 2026-05-28
**Depth:** Light research — established pattern, straightforward SQL migration + documentation.

## Summary

S03 has two deliverables: (1) a Supabase migration that sets `app.settings.require_invite` to `false` so local dev starts with open registration, and (2) a production runbook documenting how to toggle the gate in the Supabase Dashboard/SQL Editor.

The `invites_required()` RPC (both `private` and `public` wrappers) reads `current_setting('app.settings.require_invite', true)` and defaults to `'true'` when unset. The `handle_new_user()` trigger and `enforce_invited_oauth_signup()` trigger both read this GUC directly — no vault lookup is involved for this setting. A single `ALTER DATABASE postgres SET app.settings.require_invite = 'false';` in a new migration flips the gate for all local sessions.

The existing `PRODUCTION_SETUP.md` already documents the `ALTER DATABASE postgres SET app.settings.*` pattern for `supabase_url`, `service_role_key`, and `admin_email`. The invite gate runbook follows the same pattern: run the ALTER DATABASE command in Supabase SQL Editor, then verify via `SELECT public.invites_required();`.

## Recommendation

**Task 1 — Migration:** Create `supabase/migrations/20260601012000_disable_invite_gate.sql` containing a single `ALTER DATABASE postgres SET app.settings.require_invite = 'false';` statement with a clear header comment explaining purpose and reversibility.

**Task 2 — Runbook:** Create `supabase/docs/INVITE_GATE.md` documenting how to disable/re-enable the gate in production, with verification steps and a reference to which functions/triggers consume the setting.

Two tasks, no dependencies between them, can be done in parallel. Task 1 is the higher-value deliverable (it's the actual gate flip); Task 2 is documentation.

## Implementation Landscape

### Key Files

- `supabase/migrations/20260601000000_schema_baseline.sql` — Defines `private.invites_required()` (line 2706), `private.enforce_invited_oauth_signup()` (line 2605), `public.handle_new_user()` (line 3647), and `public.invites_required()` (line 3698). All three functions read `current_setting('app.settings.require_invite', true)` directly — no vault fallback for this setting.
- `supabase/migrations/` — Latest file is `20260601011001_fix_provider_constraint.sql`. New migration should use timestamp `20260601012000`.
- `supabase/docs/PRODUCTION_SETUP.md` — Existing production runbook. Documents `ALTER DATABASE postgres SET app.settings.supabase_url`, `service_role_key`, and `admin_email` via SQL Editor. The invite gate runbook follows the same pattern and should cross-reference this file.
- `supabase/docs/` — Contains `EMAIL.md`, `LOCAL_LLM_TAGGING.md`, `PRODUCTION_SETUP.md`. The new `INVITE_GATE.md` goes here.
- `supabase/tests/invite_gate_oauth_signup.sql` — Existing SQL test that exercises both gate states (`set_config('app.settings.require_invite', 'true/false', false)`). Covers uninvited Google rejection, invited Google allowance, open Apple signup, and email provider behavior. This test should continue to pass after the migration.
- `supabase/seed.sql` — Does NOT set `require_invite`. The default `'true'` is baked into the functions' `COALESCE` calls. After the migration, the database-level setting (`'false'`) overrides the COALESCE default.

### Build Order

1. **Migration first** — highest value, provides the actual gate flip. Proves that `supabase db reset` + seed works with gate disabled.
2. **Runbook second** — documentation task, no code dependencies.

### Verification Approach

- **Migration:** Run `supabase db reset` (applies all migrations + seed), then connect to local DB and verify:
  ```sql
  SELECT public.invites_required();  -- should return false
  SELECT current_setting('app.settings.require_invite', true);  -- should return 'false'
  ```
- **Existing SQL test:** `psql "postgresql://postgres:postgres@127.0.0.1:55322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/invite_gate_oauth_signup.sql` — must still pass (it uses `set_config` to override the session-level value, so the database-level default won't interfere).
- **Web tests:** `pnpm --filter @family-events/web test` — 419 tests must still pass (no frontend changes in this slice).
- **TypeScript check:** `pnpm --filter @family-events/web check` — must pass (no frontend changes).
- **Runbook:** Manual review — document must contain disable/enable commands, verification query, and list of affected functions.

## Constraints

- `ALTER DATABASE postgres SET app.settings.require_invite = 'false'` works locally because the migration runs as superuser. On Supabase Cloud, this same command should work via the SQL Editor (consistent with existing `PRODUCTION_SETUP.md` pattern for other `app.settings.*` GUCs).
- The `invites_required()` function defaults to `true` when the GUC is unset (`COALESCE(..., 'true')`). The migration explicitly sets it to `false`, so the COALESCE never fires locally after the migration.
- The existing SQL test (`invite_gate_oauth_signup.sql`) uses `set_config(...)` to override the GUC at session level, which takes precedence over the database-level setting. The test will continue to work correctly.
- The migration must NOT be pushed to production — it's for local dev only. Production toggle is manual via SQL Editor. The migration file should have a clear comment about this.

## Common Pitfalls

- **Migration pushed to production prematurely** — If `supabase db push` is run against production, it would disable the gate. The runbook should note that the migration only affects local dev and production must be toggled manually. However, since the intent IS to eventually disable the gate for public launch, this is actually the desired outcome — the runbook documents verification steps either way.
- **Test interference from database-level GUC** — The SQL test sets `app.settings.require_invite` at session level via `set_config(..., false)`, which overrides database-level defaults. No interference expected.

## Skills Discovered

| Technology | Skill | Status |
|------------|-------|--------|
| Supabase | supabase | installed |
| PostgreSQL | supabase-postgres-best-practices | installed |

Both relevant skills are already installed. No additional skill discovery needed.
