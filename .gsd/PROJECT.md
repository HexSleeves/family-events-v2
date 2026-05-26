# family-events-ui

## What This Is

A production family-events monorepo shipping web, iOS, Android, and Railway cron infrastructure backed by Supabase. Parents browse and plan family-friendly local events. An admin interface handles event review, scraping, and enrichment. The product is live and receiving incremental improvements.

## Core Value

Parents can discover and plan age-appropriate local events across web and iOS — the event feed must be current, geocoded, and filterable.

## Project Shape

- **Complexity:** complex
- **Why:** Multiple runtime boundaries (web + iOS + Android + 6 Railway crons + Supabase edge functions), active schema migrations, client parity gaps, and enrichment pipeline reliability work all in flight simultaneously.

## Current State

- Web app (React 19 + Vite + React Router 7 + TanStack Query + Tailwind 4): fully featured — Explore with age/tag/category filters, Plan (Saturday Plan), Map, Calendar, Saved, admin.
- iOS app (SwiftUI, modular packages): Plan tab feature-complete; Explore lacks age filter, tag/category chips, and category grid; on `events_enriched` v1 (web uses v2).
- Android app (Kotlin/Compose): modular, includes admin module (unlike iOS).
- Supabase backend: 60+ migrations, RLS, 8+ edge functions, pg_cron replaced by Railway cron services, AI enrichment pipeline (geocoding via Nominatim, images via Unsplash, tag/LLM review pipeline).
- 6 Railway cron services: each a minimal Alpine/curl Docker image, drift-guarded by Terraform + Spacelift CI.
- Known gaps: iOS Explore filter parity, map sparseness due to geocoding misses, dead `useEvents`/`search_events` code in web.

## Architecture / Key Patterns

- pnpm Turborepo monorepo: `apps/web`, `apps/ios`, `apps/android`, `apps/cron-*`, `packages/contracts`, `packages/shared`, `packages/design-system`, `packages/email`.
- Supabase as the single data source: `events_enriched_v2` RPC is the primary consumer read path for web; iOS still on v1.
- Tag/age filtering is client-side on web and will be client-side on iOS — the RPC returns all matching events for the city/date window, filters applied post-fetch.
- Railway cron services call Supabase edge functions via `cron-runner.sh` with structured JSON logging and a per-label DB kill switch.
- Design tokens flow from `packages/design-system/tokens/tokens.json` → generated Swift tokens in `FEDesignSystem` and Tailwind CSS variables in web.

## Capability Contract

See `.gsd/REQUIREMENTS.md` for the explicit capability contract, requirement status, and coverage mapping.

## Milestone Sequence

- [ ] M001: iOS Parity + Geocoding Hardening — iOS Explore filter parity, `events_enriched_v2` migration, geocoding heuristic improvements, dead code removal.
