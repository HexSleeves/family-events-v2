# family-events-ui

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

## Cursor Cloud specific instructions

### Architecture overview

Turborepo monorepo with a React 19 + Vite 8 web app (`apps/web`), Supabase backend (Postgres + Auth + Edge Functions), plus iOS and Android native clients. Only the web app and Supabase are runnable on Linux VMs; iOS (requires macOS/Xcode) and Android (requires Android SDK) checks will fail — this is expected.

### Running services

1. **Docker** must be running before starting Supabase (`sudo dockerd &` if not already active; `sudo chmod 666 /var/run/docker.sock` for non-root access).
2. **Supabase local stack**: `pnpm run db:start` (pulls ~10 containers; first run takes 1–2 min).
3. **Local setup**: `bash scripts/setup-local.sh` — configures DB settings, creates `.env.development.local`, bootstraps admin user (`admin@familyevents.local` / `Admin123!`). Requires `psql` (`sudo apt-get install -y postgresql-client` if missing).
4. **Vite dev server**: `pnpm --filter @family-events/web dev` → `http://localhost:5173`.

### Key commands (see README for full list)

| Task | Command |
|------|---------|
| Lint + typecheck (web) | `pnpm --filter @family-events/web check` |
| Unit tests (all TS) | `pnpm --filter @family-events/web test && pnpm --filter @family-events/shared test && pnpm --filter @family-events/contracts test && pnpm --filter @family-events/design-system test` |
| Build (web) | `pnpm --filter @family-events/web build` |
| Guard tests | `pnpm run docs:test && pnpm run workspace:test` |
| Format | `pnpm run format` (uses oxfmt, not Prettier) |

### Gotchas

- **Node 24 required** — pinned in `mise.toml`. Use `nvm install 24 && nvm use 24` if not active.
- **pnpm 11.1.2** — declared in `packageManager` field. Activate with `corepack enable && corepack prepare pnpm@11.1.2 --activate`.
- **Linter is oxlint** (not ESLint), **formatter is oxfmt** (not Prettier). Don't install ESLint/Prettier.
- **`pnpm run check`** and **`pnpm run test`** (root-level turbo commands) will fail because they include Android/iOS workspaces. Always scope to web/shared/contracts/design-system for TS checks on this VM.
- **Supabase local ports**: API 55321, DB 55322, Studio 55323, Inbucket 55324.
- **`setup-local.sh`** must run after every `supabase db reset` to re-configure `app.settings.*` and re-bootstrap the admin user.
