# AGENTS.md — family-events-ui

Agent and workflow instructions for this monorepo. vix reads this file at the start of every session.

## Project snapshot

Turborepo monorepo. Stack:

| Layer | Tech |
|---|---|
| Web | React 19 · Vite 8 · Tailwind 4 · TanStack Query · React Router 7 · Supabase JS |
| iOS | SwiftUI · XcodeGen · local Swift packages under `Packages/` |
| Backend | Supabase (Postgres + RLS + edge functions / Deno) |
| Shared | `packages/contracts` (Zod + DB types) · `packages/shared` (framework-agnostic) |
| Design | `packages/design-system` → codegen CSS vars, Swift constants, TS tokens |
| Toolchain | pnpm 11 · Turbo · oxlint · oxfmt · Node 24 (pinned by `mise.toml`) |
| Tests | Vitest (web unit) · Playwright (e2e) · Node `--test` (guard suites) · `swift test` (iOS) |

## Workflow selection

Use the right workflow for the task:

| Situation | Workflow / command |
|---|---|
| New feature or larger change | **Plan** — explore → plan → review → execute |
| Small, well-scoped change | **Implement & Review** — implement → review → iterate |
| Bug report with reproduction | **Implement & Review** using the `debugger` agent |
| Write or expand tests | **Implement & Review** using the `tester` agent |
| Quick one-liner fix | Direct edit in `general` agent (no workflow needed) |

## Skill routing

When the user's request matches an available skill, invoke it via `/skill:<name>` before answering ad hoc.

| Signal | Skill |
|---|---|
| Product ideas, brainstorming, feature discovery | `/skill:office-hours` |
| Bug report, error, 500, unexpected behaviour | `/skill:investigate` |
| Ship feature, deploy, open PR, create release | `/skill:ship` |
| QA pass, find regressions, test coverage | `/skill:qa` |
| Code review, diff review, PR feedback | `/skill:code-review` or `/skill:code-review-excellence` |
| Update docs / changelog after shipping | `/skill:document-release` |
| Design system, tokens, brand | `/skill:design-consultation` |
| Visual / UI audit | `/skill:design-review` |
| Architecture or engineering design review | `/skill:plan-eng-review` |
| Supabase schema, RLS, migrations, edge functions | `/skill:supabase` or `/skill:supabase-postgres-best-practices` |
| TypeScript advanced types | `/skill:typescript-advanced-types` |
| React patterns, composition | `/skill:vercel-react-best-practices` or `/skill:vercel-composition-patterns` |
| JavaScript/Node patterns | `/skill:modern-javascript-patterns` or `/skill:nodejs-backend-patterns` |
| Testing patterns (JS/TS) | `/skill:javascript-testing-patterns` |
| SQL queries / optimisation | `/skill:sql-optimization` or `/skill:sql-code-review` |
| SwiftUI layout / navigation | `/skill:swiftui-patterns` or `/skill:swiftui-navigation` |
| SwiftUI animations | `/skill:swiftui-animation` |
| Swift concurrency (async/await) | `/skill:swift-concurrency` |
| Swift Codable / serialisation | `/skill:swift-codable` |
| iOS testing | `/skill:swift-testing` |
| shadcn/ui components | `/skill:shadcn` |
| Dockerfile, container | `/skill:multi-stage-dockerfile` |
| GitHub Actions | `/skill:github-actions-templates` |
| Secrets, env vars | `/skill:secrets-management` |
| Git workflows, branching | `/skill:git-advanced-workflows` |
| Terraform | `/skill:terraform-stacks` or `/skill:terraform-style-guide` |

## Hard rules for all agents

### Never touch generated files
- `apps/web/src/styles/tokens.generated.css`
- `apps/ios/Packages/FEDesignSystem/Sources/.../Generated/Tokens.swift`
- `packages/design-system/src/generated/*`

To change tokens: edit `packages/design-system/tokens/tokens.json`, then run:
```
pnpm --filter @family-events/design-system build
```

### Linting & formatting
Use **oxlint + oxfmt** only. Do not introduce ESLint or Prettier. Config lives in `packages/config-quality`.

### TypeScript
All workspaces extend `@family-events/config-typescript`. TypeScript version ~6.0.3.

### Imports across packages
`packages/shared` must remain framework-agnostic (enforced by `tests/guards/shared-boundary.test.mjs`). Do not import React or any framework-specific code there.

### iOS scope
Consumer-only. Admin features are blocked at the test layer — do not add them to iOS. Modular packages live under `apps/ios/Packages/`.

### Supabase security rules
- New `SECURITY DEFINER` RPCs → use the **private body + public wrapper** pattern.
- Functions called by pg_cron / pg_net → read secrets from `vault.decrypted_secrets` first, fall back to `app.settings.*` GUC.
- Reference: `supabase/migrations/20260601002100_wrap_security_definer_rpcs.sql`

### Web state management
| Concern | Library |
|---|---|
| Server state | TanStack Query |
| Client state | Zustand |
| Forms | React Hook Form + Zod |
| Toasts | Sonner |

### Mobile-first v2 UI primitives
New web UI must use primitives in `apps/web/src/components/v2/`:
`page.tsx` · `stack.tsx` · `toolbar.tsx` · `responsive-card.tsx` · `filter-bar.tsx` · `touch-target.tsx`

Before any UI/visual change, read `docs/DESIGN.md`.

## Verification commands

After any change, run the applicable subset:

```bash
# Full check (typecheck + lint + format) across all workspaces
pnpm run check

# Unit tests
pnpm run test

# Monorepo guard suites (boundaries, layout, iOS scope…)
pnpm run workspace:test

# Docs coverage guard
pnpm run docs:test

# Web only
pnpm --filter @family-events/web typecheck
pnpm --filter @family-events/web test

# Supabase
pnpm run db:types   # after schema changes
pnpm run db:migrate

# iOS
pnpm run ios:test

# Pre-push (runs all of the above)
pnpm run verify:workflow
```
