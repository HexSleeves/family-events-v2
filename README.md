# family-events monorepo

Turborepo monorepo for:
- web client (`apps/web`)
- iOS client (`apps/ios`)
- shared TypeScript utilities (`packages/shared`)
- runtime contracts (`packages/contracts`)
- Supabase schema/functions (`supabase`)

## Web Workspace

Path: `apps/web`

Primary commands:
- `pnpm --filter @family-events/web dev`
- `pnpm --filter @family-events/web check`
- `pnpm --filter @family-events/web test`
- `pnpm --filter @family-events/web build`

## iOS Workspace

Path: `apps/ios`

Layout (post-M1):
- App target: `FamilyEvents/` (entry point + tab shell + deep-link routing).
- Local Swift packages under `Packages/`: `FECore`, `FEData`, `FEDesignSystem`, `FEAuth`, `FEPlan`, `FEExplore`, `FESaved`, `FEEventDetail`, `FEAppIntents`.

Project generation/build strategy:
- Xcode project is generated from `apps/ios/project.yml` using XcodeGen.
- Commit the `project.yml` source of truth and generated project files together.

Primary commands:
- `pnpm run ios:generate` — regenerate `FamilyEvents.xcodeproj` from `project.yml`.
- `pnpm run ios:test` — run every package's `swift test` plus the app's `xcodebuild test`.

Scope policy:
- iOS is consumer-only.
- Admin features/routes are out of scope and blocked by `EndpointPolicyTests`.

## Shared Package

Path: `packages/shared`

Purpose:
- cross-app utility helpers that are framework-agnostic and reusable in web + tooling.

Primary commands:
- `pnpm --filter @family-events/shared test`
- `pnpm --filter @family-events/shared check`

## Contracts Package

Path: `packages/contracts`

Purpose:
- typed event/API contracts used by web and backend-facing adapters.

Primary commands:
- `pnpm --filter @family-events/contracts test`
- `pnpm --filter @family-events/contracts check`

## Supabase

Path: `supabase`

Primary commands:
- `pnpm run db:start`
- `pnpm run db:migrate`
- `pnpm run db:types`
- `pnpm run db:functions:serve`
- `pnpm run db:stop`

Reference docs:
- `supabase/docs/PRODUCTION_SETUP.md`
- `supabase/docs/EMAIL.md`

## Workflows

Local repeatable verification:
- `pnpm run docs:test`
- `pnpm run workspace:test`
- `pnpm run check`
- `pnpm run test`
- `pnpm run build`
- `pnpm run verify:workflow`

CI verification:
- Linux job validates docs/workspace guards + web/shared/contracts/supabase checks.
- macOS job validates XcodeGen + iOS tests.
