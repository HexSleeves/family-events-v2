---
id: T01
parent: S03
milestone: M001
key_files:
  - supabase/migrations/20260601012000_disable_invite_gate.sql
key_decisions:
  - Database-level GUC (ALTER DATABASE SET) chosen over session-level or config.toml approach — ensures all local connections inherit the default without extra setup
duration: 
verification_result: passed
completed_at: 2026-05-28T06:51:01.483Z
blocker_discovered: false
---

# T01: Added migration to set app.settings.require_invite='false' at the database level, giving local dev open registration by default

**Added migration to set app.settings.require_invite='false' at the database level, giving local dev open registration by default**

## What Happened

Created `supabase/migrations/20260601012000_disable_invite_gate.sql` with a single `ALTER DATABASE postgres SET app.settings.require_invite = 'false';` statement. The header comment block documents: (a) the purpose — disabling the invite gate for local dev, (b) that production toggle is managed via the Supabase SQL Editor (referencing `supabase/docs/INVITE_GATE.md`), and (c) how to re-enable locally. Verified the existing test file `supabase/tests/invite_gate_oauth_signup.sql` uses session-level `set_config()` which overrides database-level defaults, so it remains unaffected.

## Verification

Ran grep checks confirming: (1) the `app.settings.require_invite` GUC reference is present, (2) the exact `ALTER DATABASE postgres SET app.settings.require_invite = 'false'` statement is correct, (3) the test file still uses session-level `set_config` and is unaffected by the database-level default change.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `grep -q 'app.settings.require_invite' supabase/migrations/20260601012000_disable_invite_gate.sql` | 0 | ✅ pass | 10ms |
| 2 | `grep -q "ALTER DATABASE postgres SET app.settings.require_invite = 'false'" supabase/migrations/20260601012000_disable_invite_gate.sql` | 0 | ✅ pass | 10ms |
| 3 | `grep -q "set_config('app.settings.require_invite'" supabase/tests/invite_gate_oauth_signup.sql` | 0 | ✅ pass | 10ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `supabase/migrations/20260601012000_disable_invite_gate.sql`
