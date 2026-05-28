---
estimated_steps: 13
estimated_files: 1
skills_used: []
---

# T02: Create production runbook for invite gate toggle

**Why:** The invite gate cannot be toggled via migration in production — it requires manual action in Supabase Dashboard SQL Editor. A clear runbook prevents deployment mistakes and documents the complete toggle procedure including verification.

**Do:**
1. Create `supabase/docs/INVITE_GATE.md`
2. Structure with these sections:
   - **Overview** — What the invite gate does, where the setting lives (`app.settings.require_invite` GUC)
   - **Affected Functions** — List `private.invites_required()`, `public.invites_required()`, `private.enforce_invited_oauth_signup()`, `public.handle_new_user()` with brief description of how each uses the GUC
   - **Disable Gate (Open Registration)** — SQL command: `ALTER DATABASE postgres SET app.settings.require_invite = 'false';` plus note to run in Supabase Dashboard → SQL Editor
   - **Re-enable Gate (Closed Beta)** — SQL command: `ALTER DATABASE postgres SET app.settings.require_invite = 'true';`
   - **Verification** — `SELECT public.invites_required();` should return the expected boolean; note that existing sessions may need reconnection for the change to take effect
   - **Local Development** — Reference the migration `20260601012000_disable_invite_gate.sql` that sets the default for local dev; how to override locally with `set_config()`
   - **See Also** — Cross-reference `PRODUCTION_SETUP.md` for other `app.settings.*` configuration
3. Follow the style and tone of existing `PRODUCTION_SETUP.md`

**Done when:** `supabase/docs/INVITE_GATE.md` exists, is non-empty, and contains the key sections (Overview, Disable, Enable, Verification).

## Inputs

- `supabase/docs/PRODUCTION_SETUP.md`
- `supabase/migrations/20260601000000_schema_baseline.sql`

## Expected Output

- `supabase/docs/INVITE_GATE.md`

## Verification

grep -q "Disable" supabase/docs/INVITE_GATE.md

## Observability Impact

None — documentation only.
