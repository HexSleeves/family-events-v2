# RFC: Cross-Platform Domain Boundaries and Anti-Corruption Layer

Status: proposed
Owner: Principal Eng
Date: 2026-05-17
Task: P2-001

## Context

Family Events now has three client surfaces and shared packages:

- Web: `apps/web`
- iOS: `apps/ios`
- Android: `apps/android`
- TypeScript shared packages: `packages/shared`, `packages/contracts`
- Backend boundary: `supabase`

The same domain concepts are repeated across platforms: events, plans, saved/favorites, cities, profiles, comments, ratings, auth sessions, weather, and source/admin workflows. Each platform can optimize presentation and persistence locally, but backend SDKs, generated database shapes, browser APIs, mobile SDKs, and platform storage must not leak into shared domain code or peer feature modules.

## Decision

Use explicit boundary layers per platform and enforce them with repository guard tests.

## Domain Package Boundaries

### TypeScript Packages

`packages/shared`

- Owns framework-neutral pure utilities only.
- May expose date, URL, text-cleanup, and other deterministic helpers.
- Must not import React, DOM APIs, Supabase SDKs, web aliases, mobile code, generated database types, or app feature modules.
- Must not depend on `packages/contracts`; shared utilities stay lower-level than transport contracts.

`packages/contracts`

- Owns backend/API contract types and generated Supabase database types.
- May contain schema validators such as Zod and generated type exports.
- Must not import app code, React, DOM APIs, mobile code, or `packages/shared`.
- Is the only TypeScript package that may publish generated database type exports.

### Web

`apps/web/src/lib`

- Owns the web anti-corruption layer for Supabase, generated DB aliases, query keys, row parsing, and domain mappers.
- `apps/web/src/lib/supabase.ts` is the only runtime constructor for the Supabase browser client.
- Feature hooks and pages consume local `lib` abstractions and domain types instead of constructing SDK clients directly.

`apps/web/src/features/*`

- Own UI state, presentation, route workflows, and feature-level orchestration.
- May call `apps/web/src/lib` helpers and workspace packages.
- Must not create Supabase clients or import runtime SDK modules directly.
- Existing type-only SDK imports are tolerated for incremental migration, but new runtime SDK imports must be rejected.

### iOS

`FECore`

- Owns platform-neutral domain primitives: identifiers, app errors, endpoint paths, dates, coordinates, environment value objects, and pure sanitizers.
- Must not import Supabase, SwiftUI, WeatherKit, CoreLocation, SwiftData, or feature packages.

`FEData`

- Owns iOS anti-corruption adapters for Supabase, WeatherKit, CoreLocation, SwiftData/local cache, repositories, DTOs, and mappers.
- Translates remote DTOs and platform SDK types into `FECore` domain models and repository protocols.
- May publish `FEDataTesting` fakes for feature tests.

`FEAuth`

- Owns auth-specific UI/session workflows and the Supabase auth adapter.
- May depend on `FECore`, `FEData`, and `FEDesignSystem`.

`FEPlan`, `FEExplore`, `FESaved`, `FEEventDetail`, `FEAppIntents`

- Own feature screens, view models, and feature composition.
- Depend on `FECore`, repository contracts/fakes from `FEData`, and `FEDesignSystem` as needed.
- Must not import Supabase directly.
- Must not import CoreLocation or WeatherKit directly; location/weather access flows through `FEData` service protocols.

### Android

`:core`

- Owns domain primitives and pure helpers.
- Must not depend on Supabase, Ktor, Room, Compose, or feature modules.

`:data`

- Owns Android anti-corruption adapters: Supabase client factory, Ktor consumer API, Room cache, repository interfaces/implementations, DTOs, and mappers.
- Translates remote/cache models into `:core` domain models and repository contracts.

`:designsystem`

- Owns Compose UI primitives/tokens and may depend on `:core`.
- Must not depend on `:data` or external data SDKs.

`:auth`, `:plan`, `:explore`, `:saved`, `:eventdetail`, `:platform`

- Own feature UI/composition and platform actions.
- Consume `:core`, `:data` repository contracts, and `:designsystem`.
- Must not import Supabase, Ktor, or Room directly.

`:app`

- Owns application assembly, dependency wiring, build config, and platform persistence setup.
- May create Room database instances and wire `:data` implementations, but should not own domain mapping logic.

## Anti-Corruption Contracts

1. External SDKs terminate at adapter modules:
   - Web Supabase runtime: `apps/web/src/lib/supabase.ts`
   - iOS Supabase/runtime platform services: `FEData`; auth-specific Supabase calls: `FEAuth`
   - Android Supabase/Ktor/Room: `:data`; app-level Room construction: `:app`

2. Generated database types do not become app-wide domain models.
   - TypeScript generated types are exported through `@family-events/contracts/database-types` and narrowed in app-local schemas/mappers.
   - Swift/Kotlin repositories expose domain models and protocol interfaces rather than raw remote row structures.

3. Feature modules do not depend on each other's internals unless the relationship is an explicit product composition dependency.
   - `FEPlan`, `FEExplore`, and `FESaved` may depend on `FEEventDetail` for shared event detail presentation.
   - Android `:plan`, `:explore`, and `:saved` may depend on `:eventdetail` for the same reason.
   - No feature module may depend on admin-only web routes or backend implementation code.

4. Cross-platform reuse is via contracts and pure utilities, not app source imports.
   - No app may import source files from another app.
   - Shared behavior must be promoted to `packages/shared`, `packages/contracts`, `FECore`, or Android `:core` before reuse.

5. Boundary changes require a guard update.
   - If a new adapter module is created, update `tests/guards/domain-boundaries.test.mjs` in the same change.
   - If a feature needs a new dependency direction, document the reason in this RFC or a successor RFC.

## Enforcement

`tests/guards/domain-boundaries.test.mjs` enforces the first line of defense:

- TypeScript shared/contracts packages remain platform-neutral.
- Web runtime Supabase SDK imports stay behind `apps/web/src/lib/supabase.ts`.
- iOS Supabase/CoreLocation/WeatherKit imports stay behind `FEData` or `FEAuth` where allowed.
- Android Supabase/Ktor/Room imports stay behind `:data` or app-level assembly where allowed.
- Gradle and Swift package dependency manifests keep external data SDK dependencies out of feature modules.

The guard is included in `pnpm run workspace:test`.

## Non-Goals

- This RFC does not move existing web feature hooks to a repository facade.
- This RFC does not implement mobile realtime lifecycle changes.
- This RFC does not change Turbo, CI, Railway, or deployment configuration.
- This RFC does not redefine database schema ownership or Supabase function runtime policy.

## Definition of Done

- RFC exists in `docs/rfcs`.
- Guard tests encode the agreed import and dependency boundaries.
- Guard tests pass locally.
- The audit task list should remain open until this RFC is explicitly approved.
