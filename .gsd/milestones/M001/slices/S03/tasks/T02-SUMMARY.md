---
id: T02
parent: S03
milestone: M001
key_files:
  - supabase/docs/INVITE_GATE.md
key_decisions:
  - Runbook uses same heading/code-block style as PRODUCTION_SETUP.md for consistency
  - Included reconnection caveat for ALTER DATABASE since pooled connections retain old GUC values
duration: 
verification_result: passed
completed_at: 2026-05-28T06:52:20.634Z
blocker_discovered: false
---

# T02: Created production runbook documenting invite gate toggle via SQL Editor with verification steps and local override instructions

**Created production runbook documenting invite gate toggle via SQL Editor with verification steps and local override instructions**

## What Happened

Created `supabase/docs/INVITE_GATE.md` following the style and tone of the existing `PRODUCTION_SETUP.md`. The runbook covers:

1. **Overview** — explains `app.settings.require_invite` GUC and its default-to-true behavior
2. **Affected Functions** — table listing `private.invites_required()`, `public.invites_required()`, `private.enforce_invited_oauth_signup()`, and `public.handle_new_user()` with how each reads the GUC
3. **Disable Gate** — exact `ALTER DATABASE` SQL to run in Supabase Dashboard SQL Editor
4. **Re-enable Gate** — reverse SQL command
5. **Verification** — `SELECT public.invites_required()` with expected results table and reconnection caveat
6. **Local Development** — references the T01 migration (`20260601012000_disable_invite_gate.sql`) and shows `set_config()` for temporary session overrides
7. **See Also** — cross-references `PRODUCTION_SETUP.md` for other `app.settings.*` configuration

All function names and behavior were verified against the baseline schema migration.

## Verification

Verified file exists and contains all required sections: Disable, Re-enable, Verification, Affected Functions, Local Development, See Also. Cross-references PRODUCTION_SETUP.md and migration 20260601012000. File is 87 lines.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `grep -q 'Disable' supabase/docs/INVITE_GATE.md && 6 more section checks` | 0 | ✅ pass | 51ms |

## Deviations

Section titled 'Invite Gate' (H1) instead of separate 'Overview' H2 — the overview content is the opening paragraphs before the first H2, matching PRODUCTION_SETUP.md's pattern of intro text before numbered sections.

## Known Issues

None.

## Files Created/Modified

- `supabase/docs/INVITE_GATE.md`
