# Project

## What This Is

Family Events is a consumer-facing web + iOS + Android platform for discovering, saving, and planning around family-friendly local events. It's backed by Supabase (Postgres, edge functions, cron jobs for scraping/enrichment/review). The web app is React 19 + Vite 8 + Tailwind 4 + TanStack Query, deployed on Railway. Currently running in closed beta behind an invite code gate.

## Core Value

Parents can discover curated local family events, save favorites, and plan their week — without juggling multiple tabs and sources.

## Project Shape

- **Complexity:** complex
- **Why:** Full-stack monorepo with web + mobile clients, Supabase backend with edge functions, cron jobs, RLS policies, and an invite gate system spanning DB triggers through frontend UI.

## Current State

The platform is feature-complete for public launch. Web, iOS, and Android clients are functional. The event pipeline (scraping → enrichment → review → publish) is operational. The invite code gate is the last feature gate blocking open registration. CI has minor issues (3 format violations, 1 misnamed Deno test) and build output has large chunks that need splitting.

## Architecture / Key Patterns

- **Monorepo:** Turborepo with pnpm workspaces. Apps: web, ios, android, cron services. Packages: contracts, shared, design-system, email, deploy-cli, config-typescript, config-quality.
- **Web:** React 19 + Vite 8, React Router 7, TanStack Query for server state, Zustand for client state, Sonner for toasts, oxlint + oxfmt for linting/formatting.
- **Backend:** Supabase (Postgres 17, edge functions in Deno, RLS policies, pg_cron). Private body + public wrapper pattern for SECURITY DEFINER RPCs.
- **Design system:** Single source of truth in `packages/design-system/tokens/tokens.json`, codegen produces CSS vars, Swift constants, Kotlin tokens, TS tokens.
- **Invite gate:** Controlled by `app.settings.require_invite` GUC, exposed via `invites_required()` RPC, enforced by DB triggers and frontend UI.

## Capability Contract

See `.gsd/REQUIREMENTS.md` for the explicit capability contract, requirement status, and coverage mapping.

## Milestone Sequence

- [ ] M001: Production Readiness and Open Registration — Full audit/cleanup of web + Supabase, make invite gate UI reactive to DB state, disable the gate for public launch, optimize bundle splitting.
