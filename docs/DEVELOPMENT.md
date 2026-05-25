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

For web/shared/package changes:

```bash
pnpm run verify:web
```

For iOS-only changes:

```bash
pnpm run verify:ios
```

For Android-only changes:

```bash
pnpm run verify:android
```

For full pre-push verification:

```bash
pnpm run verify:workflow
```

`verify:workflow` delegates to `verify:full`.

Guard suites:

```bash
pnpm run docs:test
pnpm run workspace:test
pnpm run knip
```

Artifact cleanup:

```bash
pnpm run clean:artifacts
```
