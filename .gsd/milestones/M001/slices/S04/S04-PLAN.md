# S04: Bundle Optimization and Final Verification

**Goal:** web:build produces no chunk over 500KB except maplibre. pnpm run verify:web passes end-to-end with zero failures.
**Demo:** After this: web:build produces no chunk over 500KB except maplibre. pnpm run verify:web passes end-to-end.

## Must-Haves

- `pnpm --filter @family-events/web build` emits chunk-size warnings only for the maplibre chunk (>500KB is expected/exempt)
- All new vendor chunks (date-fns, radix-ui, supabase, and optionally d3) appear in build output at <500KB each
- The index chunk drops below 500KB (from ~557KB)
- The recharts chunk drops below 500KB (from ~521KB) if d3 extraction is effective; otherwise the 21KB overage is accepted as a lazy-loaded route-specific chunk
- Bundle preload budget guard continues to pass (total preload ≤1MB, no forbidden preloads)
- `pnpm run verify:web` exits 0 — all 7 steps pass: docs:test, workspace:test, packages:check, packages:test, web:check, web:test, web:build

## Proof Level

- This slice proves: operational — real production build output verifies chunk sizes; full CI pipeline proves no regressions

## Integration Closure

Upstream: Green CI baseline (S01), reactive invite gate UI (S02), disabled gate migration (S03) — all prior slices complete.
New wiring: Extended manualChunks in vite.config.ts; no new runtime code, only build-time configuration.
After this: Milestone M001 is fully verified end-to-end — nothing remains.

## Verification

- None — this slice only changes build-time chunk splitting configuration. No runtime signals, endpoints, or diagnostics are affected.

## Tasks

- [x] **T01: Extend manualChunks to split oversized vendor chunks below 500KB** `est:30m`
  **Why:** The production build currently produces three chunks over 500KB: index (~557KB), recharts (~521KB), and maplibre (~1055KB). maplibre is exempt (WebGL renderer). Per D003, we extract date-fns, @radix-ui, and @supabase into dedicated vendor chunks to shrink the index chunk. We also extract d3 sub-packages (used only by recharts) to reduce the recharts chunk.
  - Files: `apps/web/vite.config.ts`
  - Verify: pnpm --filter @family-events/web build

- [x] **T02: Run full verify:web pipeline as final pre-launch gate** `est:20m`
  **Why:** R012 requires `pnpm run verify:web` to pass end-to-end as the final gate before launch. This runs all 7 CI steps: docs:test, workspace:test, packages:check, packages:test, web:check, web:test, web:build. The bundle budget guard (web-bundle-budget.test.mjs) runs as part of workspace:test and validates preload budget ≤1MB and no forbidden preloads. The build step validates chunk sizes.
  - Verify: pnpm run verify:web

## Files Likely Touched

- apps/web/vite.config.ts
