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

## Phase 3 — iOS hardening

### Snapshot testing harness for FEDesignSystem

- **What:** Add `pointfreeco/swift-snapshot-testing` dependency to `apps/ios/Packages/FEDesignSystem/Package.swift` and produce light/dark/Dynamic Type snapshot tests for `EventCard` (and future `StarRating`, `FavoriteButton`). Configure baseline-image storage + CI simulator pinning for stable rendering.
- **Why:** iOS spec §10 explicitly mandates snapshot tests on FEDesignSystem primitives. M5 Explore will introduce additional card variants and reuse `EventCard` heavily; without snapshots, accidental visual regressions land silently across both Plan and Explore surfaces. Catching this now is cheaper than after M5 multiplies the surface area.
- **Context:** Captured during /plan-eng-review on 2026-05-14 of the iOS M3 Plan tab plan. M3 ships `EventCard` (the shared primitive) without snapshot coverage; this TODO lands as a prerequisite for M5 EventCard reuse. The harness work itself (~2-3 hours: dep setup, CI baseline images, simulator pinning) is heavier than M3 should absorb, but trivial to revisit before M5 begins.
- **Pros:** Spec compliance; catches visual regressions before they reach TestFlight; baseline-image diff comments on PRs make design-side review concrete.
- **Cons:** New CI artifact storage (snapshot PNGs in-tree or via Git LFS); simulator pin friction when Xcode updates change rendering subtly.
- **Depends on:** M5 Explore implementation start; no upstream blockers.
