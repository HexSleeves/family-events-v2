# family-events-ui

This is the single source of truth for agent instructions in this repo. `CLAUDE.md` and editor-specific files point here.

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:

- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
- Remove AI-generated artifacts / slop → invoke de-slop

## Architecture overview

Turborepo monorepo. Workspaces declared in `pnpm-workspace.yaml`: `apps/*`, `packages/*`, `supabase/functions`.

- `apps/web` — React 19 + Vite 8 + Tailwind 4 + TanStack Query + React Router 7 + Supabase client. Tests via Vitest, e2e via Playwright.
- `apps/ios` — SwiftUI app generated from `apps/ios/project.yml` via XcodeGen. Modularized into local Swift packages under `Packages/`. **Consumer-only**; admin endpoints are blocked by `EndpointPolicyTests`.
- `apps/android` — Android client. Scoped commands: `pnpm run android:check | android:test | android:build`.
- `apps/cron-cleanup-stale`, `apps/cron-db-maintenance`, `apps/cron-enrich-events`, `apps/cron-review-events`, `apps/cron-scrape-sources`, `apps/cron-tag-queue` — Railway-hosted cron services. Each ships a Dockerfile and uses the shared `scripts/cron-runner.sh` runtime. Deployed via `scripts/deploy.sh`.
- `apps/_shared/db/` — internal module reused by cron services (consumed via `workspace:*`).
- `packages/contracts` — Zod schemas + generated `database.types.ts`. Shared between web and edge functions.
- `packages/shared` — Framework-agnostic helpers. Boundary enforced by `tests/guards/shared-boundary.test.mjs`.
- `packages/design-system` — Single source of truth for tokens. Codegen produces web CSS vars, Swift constants, and TS tokens. Never hand-edit generated files.
- `packages/email` — React Email templates rendered into Supabase auth emails.
- `packages/config-typescript`, `packages/config-quality` — Shared tsconfig and oxlint/oxfmt configs.
- `supabase/` — Migrations, edge functions (Deno), seed, RLS tests, rollbacks.
- `tests/guards/` — Node `--test` guard suites that enforce monorepo layout, iOS/Android scope, package boundaries, and docs coverage.

Only the web app, Android (with SDK), and Supabase are runnable on Linux VMs; iOS requires macOS/Xcode and will fail elsewhere — this is expected.

## Running services

1. **Docker** must be running before starting Supabase (`sudo dockerd &` if not already active; `sudo chmod 666 /var/run/docker.sock` for non-root access).
2. **Supabase local stack**: `pnpm run db:start` (pulls ~10 containers; first run takes 1–2 min).
3. **Local setup**: `bash scripts/setup-local.sh` — configures DB settings, creates `.env.development.local`, bootstraps admin user (`admin@familyevents.local` / `Admin123!`). Requires `psql` (`sudo apt-get install -y postgresql-client` if missing).
4. **Vite dev server**: `pnpm --filter @family-events/web dev` → `http://localhost:5173`.

## Key commands

| Task | Command |
|------|---------|
| Lint + typecheck (web) | `pnpm --filter @family-events/web check` |
| Unit tests (all TS) | `pnpm --filter @family-events/web test && pnpm --filter @family-events/shared test && pnpm --filter @family-events/contracts test && pnpm --filter @family-events/design-system test` |
| Build (web) | `pnpm --filter @family-events/web build` |
| Android check / test / build | `pnpm run android:check`, `android:test`, `android:build` |
| iOS regenerate / test | `pnpm run ios:generate`, `pnpm run ios:test` |
| Guard tests | `pnpm run docs:test && pnpm run workspace:test` |
| Format | `pnpm run format` (uses oxfmt, not Prettier) |
| Pre-push verification | `pnpm run verify:workflow` |
| Deploy edge functions / crons | `pnpm run deploy` (interactive) / `pnpm run deploy:all` (wraps `scripts/deploy.sh`) |
| Audit Railway services | `bash scripts/check-railway.sh` |

## Design System

Always read [`docs/DESIGN.md`](./docs/DESIGN.md) before making any visual or UI decisions.

All font choices, colors, spacing, radius, motion, and aesthetic direction are defined there. Do not deviate without explicit user approval.

Source of truth lives in `packages/design-system` (tokens) and is consumed by `apps/web` and `apps/ios` via codegen. Web tokens generate CSS custom properties for Tailwind 4's `@theme`. iOS tokens generate Swift constants for `FEDesignSystem`. Never hand-edit generated files (`tokens.generated.css`, `Tokens.swift`, `packages/design-system/src/generated/*`) — change `tokens/tokens.json` and run `pnpm --filter @family-events/design-system build`. `verify:drift` enforces this.

Mockup reference: [`docs/design/mocks/design-preview.html`](./docs/design/mocks/design-preview.html).

In QA mode, flag any code that doesn't match `DESIGN.md`.

## Supabase conventions

### New SECURITY DEFINER RPCs

Any new RPC that needs elevated privileges (bypass RLS, write to admin tables, etc.) MUST follow the **private body + public wrapper** pattern to keep Supabase advisor lints 0028/0029 clean.

1. Author the real function as `private.<name>` with `SECURITY DEFINER`. Grant EXECUTE on it to whichever roles legitimately reach the wrapper (typically `authenticated, service_role`; add `anon` only if the wrapper is anon-callable).
2. Author a thin `public.<name>` wrapper as `SECURITY INVOKER` whose body is `SELECT [* FROM] private.<name>(args);`. Preserve all default values on the wrapper so PostgREST clients calling with omitted optional args continue to work.
3. `REVOKE EXECUTE ON FUNCTION public.<name>(args) FROM PUBLIC, anon;` for admin-only RPCs. Anon-callable RPCs get default privs.
4. Verify every role granted EXECUTE in step 1 also holds `USAGE` on schema `private`. `anon` and `authenticated` have it from `20260601002200`; `service_role` has it from `20260601005600`. Any other role you grant EXECUTE to needs its own USAGE grant — without it the SECURITY INVOKER wrapper fails at name-resolution time with `42501: permission denied for schema private` and the failure is invisible to the migration itself (it runs as `postgres`).
5. Verify in a one-off SQL block after the migration:

   ```sql
   SET LOCAL ROLE service_role; -- or authenticated / anon
   SELECT public.<name>(<args>);
   RESET ROLE;
   ```

   Catches the USAGE/EXECUTE mismatch before deploy.

Reference migrations:

- Initial wrap: `supabase/migrations/20260601002100_wrap_security_definer_rpcs.sql`
- Queue wrap: `supabase/migrations/20260601005100_wrap_queue_security_definer_rpcs.sql`
- USAGE grant for service_role: `supabase/migrations/20260601005600_grant_private_schema_usage_service_role.sql`

### Reading Supabase project URL / service-role key

Do not rely on `app.settings.*` GUCs in functions called from pg_cron or pg_net — Supabase Cloud blocks `ALTER DATABASE ... SET app.settings.*`, so the GUCs are NULL in hosted projects and the function silently no-ops. Always read from `vault.decrypted_secrets` first, then fall back to the GUC for local-dev parity. This rule is general: any pg_cron or pg_net caller must use the vault-first lookup. Reference: `private.dispatch_email_notification` in `supabase/migrations/20260601001700_url_from_vault_fallback.sql`.

### Maintenance functions

`run_daily_maintenance` (commit `59a46888`) is the canonical pattern for cron-driven maintenance functions (data pruning, timezone refresh). Model new daily maintenance jobs on it.

## Cron jobs (Supabase + Railway)

- **Supabase pg_cron jobs** are toggleable at runtime — flip `cron.job.enabled` in the DB rather than authoring a migration to pause/resume.
- **Railway-hosted crons** live in `apps/cron-*/` (six services as of writing). Each has its own Dockerfile and reuses the shared runtime in `scripts/cron-runner.sh`. Shared DB access lives in `apps/_shared/db`.
- Deploy via `scripts/deploy.sh` (`pnpm run deploy` / `deploy:all`). The script maintains an internal `NO_VERIFY_JWT_FUNCTIONS` registry for unauthenticated callbacks (commits `cc297327`, `e602b8bf`) and pushes Railway env vars with `--skip-deploys`.
- Audit which Railway services exist vs. expected with `bash scripts/check-railway.sh` (commit `2b84382f`).

## Source types

Event source types are an extensible enum. `brec` was added in commit `f7bab8bb`. When adding a new source type, update `packages/contracts` enum and the edge function source registry together so contracts and runtime stay in sync.

## Post-work verification

After finishing any change, run these for every workspace you touched before declaring done:

```bash
# Format (always)
pnpm run format

# Check + test scoped to touched workspace(s)
pnpm --filter @family-events/web check        # if you touched apps/web
pnpm --filter @family-events/web test

pnpm --filter @family-events/shared check     # if you touched packages/shared
pnpm --filter @family-events/shared test

pnpm --filter @family-events/contracts check  # if you touched packages/contracts
pnpm --filter @family-events/contracts test

pnpm --filter @family-events/design-system check  # if you touched packages/design-system
pnpm --filter @family-events/design-system test
```

Do NOT run root-level `pnpm run check` or `pnpm run test` — they include Android/iOS workspaces and will fail on Linux VMs.

## Gotchas

- **Node 24 required** — pinned in `mise.toml`. Use `nvm install 24 && nvm use 24` if not active.
- **pnpm 11.2.2** — declared in `packageManager` field. Activate with `corepack enable && corepack prepare pnpm@11.2.2 --activate`.
- **Linter is oxlint** (not ESLint), **formatter is oxfmt** (not Prettier). Don't install ESLint/Prettier.
- **`pnpm run check`** and **`pnpm run test`** (root-level turbo commands) will fail because they include Android/iOS workspaces. Always scope to `@family-events/{web,shared,contracts,design-system}` for TS checks on Linux VMs.
- **Supabase local ports**: API 55321, DB 55322, Studio 55323, Inbucket 55324.
- **`setup-local.sh`** must run after every `supabase db reset` to re-configure `app.settings.*` and re-bootstrap the admin user.
- **New edge functions**: register the JWT verification setting in `supabase/config.toml` (`[functions.<name>] verify_jwt = false` for unauthenticated callbacks per commit `e602b8bf`). New functions default to `verify_jwt = true`.
- **Renovate** runs on a cron schedule with bumped tag-processing permissions (commit `a100c309`) — don't disable.
