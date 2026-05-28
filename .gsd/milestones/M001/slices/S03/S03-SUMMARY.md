---
id: S03
parent: M001
milestone: M001
provides:
  - Migration disabling invite gate for local dev (open registration default)
  - Production runbook for Dashboard-based gate toggle
requires:
  - slice: S02
    provides: Fully reactive invite gate UI that responds to invites_required() RPC
affects:
  - S04
key_files:
  - supabase/migrations/20260601012000_disable_invite_gate.sql
  - supabase/docs/INVITE_GATE.md
key_decisions:
  - Database-level GUC (ALTER DATABASE SET) chosen over session-level or config.toml approach — ensures all local connections inherit the default
  - Runbook uses SQL Editor approach matching PRODUCTION_SETUP.md style for consistency
  - Included reconnection caveat for ALTER DATABASE since pooled connections retain old GUC values
patterns_established:
  - ALTER DATABASE SET for local dev GUC defaults; session-level set_config() in tests for isolation
  - Production runbook pattern: Disable → Re-enable → Verify → Affected Functions → Local Dev → See Also
observability_surfaces:
  - none — admin invites gate status banner (from S02) now shows Disabled by default in local dev
drill_down_paths:
  - .gsd/milestones/M001/slices/S03/tasks/T01-SUMMARY.md
  - .gsd/milestones/M001/slices/S03/tasks/T02-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-05-28T06:53:41.324Z
blocker_discovered: false
---

# S03: Disable Invite Gate and Production Runbook

**Migration disables invite gate for local dev (open registration by default) and production runbook documents Dashboard-based gate toggle**

## What Happened

Two tasks delivered the slice goal cleanly with no blockers or deviations.

**T01 — Migration to disable invite gate:** Created `supabase/migrations/20260601012000_disable_invite_gate.sql` containing `ALTER DATABASE postgres SET app.settings.require_invite = 'false'`. This database-level GUC override means all local dev connections inherit open registration without manual configuration. The migration sorts correctly after the schema baseline (20260601000000) and includes comments explaining the relationship between database-level defaults and session-level overrides used in tests.

**T02 — Production runbook:** Created `supabase/docs/INVITE_GATE.md` (87 lines) documenting the complete toggle procedure for production. Sections cover: disabling the gate, re-enabling it, verification queries, affected functions list, local development overrides, and cross-references to PRODUCTION_SETUP.md. Includes a reconnection caveat for ALTER DATABASE since pooled connections retain old GUC values until reconnected. Uses the same heading/code-block style as PRODUCTION_SETUP.md for consistency.

## Verification

All verification checks passed:

1. **Migration file exists and is correct** — `supabase/migrations/20260601012000_disable_invite_gate.sql` contains `ALTER DATABASE postgres SET app.settings.require_invite = 'false'` with explanatory comments
2. **Runbook file complete** — `supabase/docs/INVITE_GATE.md` (87 lines) contains all required sections: Disable, Re-enable, Verification, Affected Functions, Local Development, See Also
3. **SQL test integrity** — `supabase/tests/invite_gate_oauth_signup.sql` still uses session-level `set_config()` which overrides the database-level default, confirming tests are unaffected
4. **Migration ordering** — `20260601012000` sorts after `20260601000000` (schema baseline) confirming correct application order
5. **Web tests pass** — 43 test files, 419 tests, all passing (no frontend changes in this slice)

## Requirements Advanced

- R003 — With gate disabled by default in local dev, marketing page now shows open-registration UI without manual configuration.

## Requirements Validated

- R006 — Migration 20260601012000 sets app.settings.require_invite='false' at database level. Verified via grep. Production runbook at supabase/docs/INVITE_GATE.md. 419 web tests pass.
- R007 — supabase/docs/INVITE_GATE.md (87 lines) contains Disable, Re-enable, Verification, Affected Functions, Local Development, See Also sections with step-by-step instructions.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Operational Readiness

None.

## Deviations

None.

## Known Limitations

Production gate toggle requires manual Dashboard action — cannot be automated via migration on Supabase Cloud.

## Follow-ups

None.

## Files Created/Modified

- `supabase/migrations/20260601012000_disable_invite_gate.sql` — New migration setting app.settings.require_invite='false' at database level for local dev open registration
- `supabase/docs/INVITE_GATE.md` — Production runbook documenting invite gate toggle via SQL Editor with verification steps and local override instructions
