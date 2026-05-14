# Development Guide

## Web (apps/web)

Install:
- `pnpm install`

Run:
- `pnpm --filter @family-events/web dev`

Quality:
- `pnpm --filter @family-events/web lint`
- `pnpm --filter @family-events/web format:check`
- `pnpm --filter @family-events/web typecheck`
- `pnpm --filter @family-events/web test`

Build:
- `pnpm --filter @family-events/web build`

## iOS (apps/ios)

Generate project from XcodeGen spec:
- `pnpm run ios:generate`

Run tests:
- `pnpm run ios:test`

Policy:
- iOS workspace only targets consumer flows.
- Admin scope is intentionally excluded and enforced by `ConsumerAPIPathTests`.

## Shared + Contracts (packages)

Shared package:
- `pnpm --filter @family-events/shared check`
- `pnpm --filter @family-events/shared test`

Contracts package:
- `pnpm --filter @family-events/contracts check`
- `pnpm --filter @family-events/contracts test`

## Supabase (root/supabase)

Start local stack:
- `pnpm run db:start`

Migrations:
- `pnpm run db:migrate`
- `pnpm run db:types`

Functions:
- `pnpm run db:functions:serve`

Stop:
- `pnpm run db:stop`

## CI and Local Verification Workflows

Single command for repeatable local verification:
- `pnpm run verify:workflow`

Guard suites:
- `pnpm run docs:test`
- `pnpm run workspace:test`

Pipeline mirrors:
- Linux CI runs docs/workspace/web/shared/contracts/supabase checks.
- macOS CI runs XcodeGen generation and iOS tests.
