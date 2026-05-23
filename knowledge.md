# Project knowledge

Turborepo monorepo for **family-events**: a consumer-facing web + iOS app for browsing/saving family-friendly events, backed by Supabase.

## Layout

- `apps/web` — React 19 + Vite 8 + Tailwind 4 + TanStack Query + React Router 7 + Supabase client. Tests via Vitest, e2e via Playwright. Design tokens consumed via Tailwind 4 `@theme` (CSS vars).
- `apps/ios` — SwiftUI app generated from `apps/ios/project.yml` via XcodeGen. Modularized into local Swift packages under `Packages/` (`FECore`, `FEData`, `FEDesignSystem`, `FEAuth`, `FEPlan`, `FEExplore`, `FESaved`, `FEEventDetail`, `FEAppIntents`). **Consumer-only**; admin endpoints are blocked by `EndpointPolicyTests`.
- `packages/contracts` — Zod schemas + generated `database.types.ts` (from Supabase). Shared between web and edge functions.
- `packages/shared` — Framework-agnostic helpers (date, url-validation, etc.).
- `packages/design-system` — **Single source of truth** for tokens (`tokens/tokens.json`). Codegen produces web CSS vars (`apps/web/src/styles/tokens.generated.css`), Swift constants (`apps/ios/Packages/FEDesignSystem/Sources/.../Generated/Tokens.swift`), and TS tokens.
- `packages/config-typescript`, `packages/config-quality` — Shared tsconfig and oxlint/oxfmt configs.
- `supabase/` — Migrations, edge functions (Deno), seed, RLS tests, rollbacks.
- `tests/guards/` — Node `--test` guard suites that enforce monorepo layout, iOS scope, package boundaries, and docs coverage.

## Quickstart

- Toolchain: `mise.toml` pins Node 24. Package manager: **pnpm 11.2.2**.
- Install: `pnpm install`
- Dev (all workspaces): `pnpm run dev` (uses `turbo run dev`)
- Web only: `pnpm --filter @family-events/web dev`

## Commands

Root (turbo):
- `pnpm run check` — typecheck + lint + format check across workspaces
- `pnpm run test` — unit tests across workspaces
- `pnpm run build`
- `pnpm run format` / `pnpm run format:check`
- `pnpm run docs:test` — docs-coverage guard
- `pnpm run workspace:test` — all monorepo guard suites
- `pnpm run verify:workflow` — full local pre-CI verification (`scripts/check-monorepo.sh`)

Web (`apps/web`):
- `pnpm --filter @family-events/web dev | build | typecheck | lint | test | test:e2e`
- Linter is **oxlint**, formatter is **oxfmt** (not ESLint/Prettier).

iOS (`apps/ios`):
- `pnpm run ios:generate` — regenerate `FamilyEvents.xcodeproj` from `project.yml` (commit both)
- `pnpm run ios:test` — `swift test` for every package + `xcodebuild test` for the app

Supabase:
- `pnpm run db:start` / `db:stop`
- `pnpm run db:migrate` — applies migrations to local
- `pnpm run db:types` — regenerates `packages/contracts/src/database.types.ts` from local schema
- `pnpm run db:functions:serve`

## Conventions

- **Linting/formatting:** oxlint + oxfmt only. Configs in `packages/config-quality`. Do not introduce ESLint/Prettier.
- **TypeScript:** ~6.0.3 across workspaces; extend from `@family-events/config-typescript`.
- **Imports across packages:** apps depend on `@family-events/{contracts,shared,design-system}` via `workspace:*`. `packages/shared` must remain framework-agnostic (enforced by `tests/guards/shared-boundary.test.mjs`).
- **Design system:** ALWAYS read `docs/DESIGN.md` before any UI/visual change. Never hand-edit generated files (`tokens.generated.css`, `Tokens.swift`, `packages/design-system/src/generated/*`); change `tokens/tokens.json` and run `pnpm --filter @family-events/design-system build`. `verify:drift` enforces this.
- **Mobile-first v2 primitives:** New web UI uses primitives in `apps/web/src/components/v2/` (`page.tsx`, `stack.tsx`, `toolbar.tsx`, `responsive-card.tsx`, `filter-bar.tsx`, `touch-target.tsx`).
- **iOS scope:** Consumer-only. Admin features and routes are blocked at the test layer — don't try to add them to iOS.
- **State/data on web:** TanStack Query for server state, Zustand for client state, React Hook Form + Zod for forms, Sonner for toasts.

## Supabase gotchas (from CLAUDE.md)

- **New SECURITY DEFINER RPCs** must follow the **private body + public wrapper** pattern (private `SECURITY DEFINER`, public `SECURITY INVOKER` thin wrapper that selects from it). REVOKE EXECUTE on admin-only wrappers from PUBLIC and anon. Reference: `supabase/migrations/20260601002100_wrap_security_definer_rpcs.sql`.
- **Project URL / service-role key in functions called by pg_cron / pg_net**: read from `vault.decrypted_secrets` first, fall back to `app.settings.*` GUC for local-dev parity. Supabase Cloud blocks `ALTER DATABASE ... SET app.settings.*`, so GUC-only code silently no-ops in prod. Reference: `supabase/migrations/20260601001700_url_from_vault_fallback.sql`.
- **Scheduled scraping** requires `app.settings.supabase_url` + `service_role_key` (or vault secrets) configured in the prod project; otherwise the cron job no-ops silently. See `TODOS.md` Phase 1.

## Workflows / verification

- **Linux CI:** docs/workspace guards + web/shared/contracts/supabase checks.
- **macOS CI:** XcodeGen + iOS tests.
- Before pushing: run `pnpm run verify:workflow`.

## Skill routing

When the user's request matches an available skill, invoke it via `/skill:<name>` instead of answering ad-hoc.

Key routing rules:
- Product ideas, brainstorming → `/skill:office-hours`
- Bugs, errors, 500s → `/skill:investigate`
- Ship, deploy, create PR → `/skill:ship`
- QA, find bugs → `/skill:qa`
- Code review → `/skill:review`
- Update docs after shipping → `/skill:document-release`
- Design system, brand → `/skill:design-consultation`
- Visual audit → `/skill:design-review`
- Architecture review → `/skill:plan-eng-review`
- Supabase tasks → `/skill:supabase`

## Verifying Changes

After any code changes, run these commands to verify correctness:

- Run `pnpm run check` to typecheck + lint + format check across all workspaces
- Run `pnpm run test` to run unit tests
- Run `pnpm run workspace:test` to run monorepo guard suites
- For web-only changes: `pnpm --filter @family-events/web typecheck` then `pnpm --filter @family-events/web test`
- Before pushing: `pnpm run verify:workflow`
