# S03: Disable Invite Gate and Production Runbook

**Goal:** Local dev starts with the invite gate disabled (open registration). A production runbook in supabase/docs/ documents the Dashboard steps to flip the gate in production.
**Demo:** After this: local dev starts with the invite gate disabled (open registration). A production runbook in supabase/docs/ documents the Dashboard steps to flip the gate in production.

## Must-Haves

- New migration `20260601012000_disable_invite_gate.sql` exists and contains `ALTER DATABASE postgres SET app.settings.require_invite = 'false'`
- After applying all migrations, `SELECT public.invites_required()` returns `false`
- Existing SQL test `supabase/tests/invite_gate_oauth_signup.sql` still passes (session-level set_config overrides DB default)
- `supabase/docs/INVITE_GATE.md` exists with disable/enable commands, verification query, and list of affected functions
- Web tests still pass (no frontend changes in this slice)

## Proof Level

- This slice proves: Contract — migration correctness verified by SQL query; runbook verified by file existence and content checks. No runtime required.

## Integration Closure

- Upstream surfaces consumed: `supabase/migrations/20260601000000_schema_baseline.sql` (defines invites_required() RPC and GUC references), `supabase/docs/PRODUCTION_SETUP.md` (existing ALTER DATABASE pattern)
- New wiring: Migration adds database-level GUC override that changes default behavior of invites_required() from true→false for local dev
- What remains: S04 (bundle optimization and final verify:web pass)

## Verification

- None — no runtime signals or diagnostic surfaces added. The admin invites gate status banner (from S02) will now show "Disabled" by default in local dev, which is the desired observable outcome.

## Tasks

- [x] **T01: Create migration to disable invite gate for local dev** `est:15m`
  **Why:** Local dev currently defaults to gate-on because the invites_required() functions COALESCE to 'true' when app.settings.require_invite is unset. For open registration, local dev must start with the gate disabled so developers see the correct open-registration UI without manual configuration.
  - Files: `supabase/migrations/20260601012000_disable_invite_gate.sql`
  - Verify: grep -q "app.settings.require_invite" supabase/migrations/20260601012000_disable_invite_gate.sql

- [x] **T02: Create production runbook for invite gate toggle** `est:20m`
  **Why:** The invite gate cannot be toggled via migration in production — it requires manual action in Supabase Dashboard SQL Editor. A clear runbook prevents deployment mistakes and documents the complete toggle procedure including verification.
  - Files: `supabase/docs/INVITE_GATE.md`
  - Verify: grep -q "Disable" supabase/docs/INVITE_GATE.md

## Files Likely Touched

- supabase/migrations/20260601012000_disable_invite_gate.sql
- supabase/docs/INVITE_GATE.md
