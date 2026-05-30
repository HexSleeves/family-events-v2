# Project

## What This Is

Family Events is a consumer-facing web + iOS + Android platform for discovering, saving, and planning around family-friendly local events. It's backed by Supabase (Postgres, edge functions, cron jobs for scraping/enrichment/review). The web app is React 19 + Vite 8 + Tailwind 4 + TanStack Query, deployed on Railway. Currently running in closed beta behind an invite code gate.

## Core Value

Parents can discover curated local family events, save favorites, and plan their week — without juggling multiple tabs and sources.

## Project Shape

- **Complexity:** complex
- **Why:** Full-stack monorepo with web + mobile clients, Supabase backend with edge functions, cron jobs, RLS policies, an invite gate system, and now an adaptive pipeline memory layer spanning vector embeddings through LLM prompt augmentation.

## Current State

The platform is feature-complete for public launch. The event pipeline (scraping → enrichment → review → publish) is operational and now includes adaptive memory: vector embeddings for event similarity, admin decision capture as ground truth, memory-augmented tagging and review prompts, source auto-rejection for high-rejection sources, and a pipeline learning dashboard. All memory features are independently feature-flagged (default off) for safe rollout. 432 web tests, 53 guards, and 29 Deno tests pass.

## Architecture / Key Patterns

- **Monorepo:** Turborepo with pnpm workspaces. Apps: web, ios, android, cron services. Packages: contracts, shared, design-system, email, deploy-cli, config-typescript, config-quality.
- **Web:** React 19 + Vite 8, React Router 7, TanStack Query for server state, Zustand for client state, Sonner for toasts, oxlint + oxfmt for linting/formatting.
- **Backend:** Supabase (Postgres 17, edge functions in Deno, RLS policies, pg_cron). Private body + public wrapper pattern for SECURITY DEFINER RPCs.
- **Design system:** Single source of truth in `packages/design-system/tokens/tokens.json`, codegen produces CSS vars, Swift constants, Kotlin tokens, TS tokens.
- **Invite gate:** Controlled by `app.settings.require_invite` GUC, exposed via `invites_required()` RPC, enforced by DB triggers and frontend UI.
- **Adaptive pipeline memory (M002):** pgvector embeddings (text-embedding-3-small, 1536-dim) with HNSW index for event similarity. Admin decisions captured via RPCs to admin_event_decisions table. Memory-augmented tagging and review prompts inject similar-event context. Source auto-reject for >80% rejection rate sources. Pipeline learning dashboard for admin observability. All features independently flagged via ai_feature_config.

## Capability Contract

See `.gsd/REQUIREMENTS.md` for the explicit capability contract, requirement status, and coverage mapping.

## Milestone Sequence

- [x] M001: Production Readiness and Open Registration — Full audit/cleanup of web + Supabase, make invite gate UI reactive to DB state, disable the gate for public launch, optimize bundle splitting.
- [x] M002: Adaptive Pipeline Memory — Vector embeddings, admin feedback capture, memory-augmented LLM prompts for tagging and review, source auto-reject, pipeline learning dashboard.
