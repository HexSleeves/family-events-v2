---
estimated_steps: 8
estimated_files: 1
skills_used: []
---

# T01: Create migration to disable invite gate for local dev

**Why:** Local dev currently defaults to gate-on because the invites_required() functions COALESCE to 'true' when app.settings.require_invite is unset. For open registration, local dev must start with the gate disabled so developers see the correct open-registration UI without manual configuration.

**Do:**
1. Create `supabase/migrations/20260601012000_disable_invite_gate.sql`
2. Add a header comment block explaining: (a) this migration disables the invite gate for local dev, (b) production toggle is manual via Supabase SQL Editor — see `supabase/docs/INVITE_GATE.md`, (c) to re-enable locally: `ALTER DATABASE postgres SET app.settings.require_invite = 'true';`
3. The migration body is a single statement: `ALTER DATABASE postgres SET app.settings.require_invite = 'false';`
4. Verify the migration file parses as valid SQL and contains the expected ALTER DATABASE statement
5. Confirm existing SQL test `supabase/tests/invite_gate_oauth_signup.sql` is unaffected — it uses session-level `set_config()` which overrides database-level defaults

**Done when:** Migration file exists with correct ALTER DATABASE statement and header comment. `grep -q` confirms the key statement is present.

## Inputs

- `supabase/migrations/20260601000000_schema_baseline.sql`
- `supabase/migrations/20260601011001_fix_provider_constraint.sql`

## Expected Output

- `supabase/migrations/20260601012000_disable_invite_gate.sql`

## Verification

grep -q "app.settings.require_invite" supabase/migrations/20260601012000_disable_invite_gate.sql

## Observability Impact

None — database-level GUC change only. Admin invites banner (S02) will now show 'Disabled' by default in local dev.
