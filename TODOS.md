# TODOs

## Phase 1 — Pre-launch

### Scheduled scraping deployment dependency

- **What:** Document and automate Supabase `app.settings.supabase_url` and `app.settings.service_role_key` injection for the `004_schedule_scraping.sql` cron job.
- **Why:** Without these settings, the scraping cron silently no-ops — scraping only works via manual admin trigger.
- **Context:** The migration uses `RAISE NOTICE` and returns if settings are missing. This must be configured in production Supabase project settings before automated scraping works.
- **Depends on:** Supabase production project deployed.

## Phase 2 — Post-launch hardening

### Integration tests for RLS + auth + edge functions

- **What:** Add Supabase integration tests verifying RLS allows/denies expected operations for admin, authenticated, and anonymous roles.
- **Why:** RLS bugs are silent (queries return empty results, no errors). Unit tests on pure functions don't catch "published event invisible to anonymous users" or "admin can't approve events."
- **Context:** Vitest unit tests cover input validation. Integration tests need Supabase local dev running. Key scenarios: anonymous can read published events, admin can update event status, non-admin cannot invoke scrape-source.
- **Depends on:** Vitest setup, Supabase local dev.
