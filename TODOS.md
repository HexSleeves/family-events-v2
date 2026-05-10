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

### Decide fate of `useEvents` hook + `search_events` RPC

- **What:** `src/hooks/use-events.ts` exports `useEvents`, which calls the `search_events` RPC (migration `008_search_events_rpc.sql`). Nothing in `src/` calls `useEvents`. The hook + RPC are dead code today.
- **Why:** Either wire `useEvents` into `explore.tsx` to enable server-side filtering (closes the original Explore-filters-client-side gap from the office-hours audit), or delete both the hook and the RPC. Current state confuses code archaeology and adds maintenance surface.
- **Context:** Captured during /plan-eng-review on 2026-05-10 of the Saturday Plan design doc. The original gap audit listed Explore client-side filtering as P1; it's still true. `events_enriched` RPC powers Explore today; `search_events` RPC is the unused parallel path.
- **Depends on:** Decision on whether server-side filtering for Explore is worth a follow-up PR (the Saturday Plan reframe doesn't touch Explore).
