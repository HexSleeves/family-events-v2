# S04: Bundle Optimization and Final Verification — Research

**Date:** 2026-05-28
**Depth:** Targeted research

## Summary

S04 optimizes the Vite production build so no chunk exceeds 500KB (except maplibre) and runs the full `verify:web` pipeline as the final pre-launch gate. The S01 build confirmed three oversized chunks: `index` (~557KB), `recharts` (~521KB), and `maplibre` (~1055KB). Per D003, the approach is to extend `manualChunks` in `vite.config.ts` to extract `date-fns`, `@radix-ui`, and `@supabase` into separate vendor chunks.

The current `manualChunks` function already isolates `maplibre`, `recharts`, `@sentry`, and `motion`. The index chunk (~557KB) contains everything else from `node_modules` that isn't route-lazy — primarily React, React DOM, React Router, TanStack Query, date-fns, @radix-ui, @supabase/supabase-js, and smaller deps. Extracting the three named libraries should reduce the index chunk below 500KB.

The `recharts` chunk (~521KB) is a separate concern — it's already isolated by `manualChunks` but slightly over budget. Recharts internally bundles d3 modules. Splitting recharts further is impractical since its d3 deps are tightly coupled. The most pragmatic path is to either accept recharts at ~521KB (it's route-lazy behind React.lazy/Suspense and already excluded from preloading) or investigate if recharts v3 tree-shaking can trim unused chart types.

The `client` chunk (282KB) is already under budget.

## Recommendation

1. Add three new `manualChunks` entries: `date-fns`, `radix-ui`, `supabase` — matching the D003 decision exactly.
2. For recharts (~521KB): check if the existing `modulePreload.resolveDependencies` filter already excludes it from first-paint preloads. If so, it's only loaded on admin dashboard routes and the 21KB overage is acceptable for a route-lazy chunk. If the budget guard specifically checks individual chunk sizes (not just preload budget), we may need to split recharts' d3 deps.
3. Run `pnpm --filter @family-events/web build` and verify chunk sizes.
4. Run `pnpm run verify:web` as the final gate.

## Implementation Landscape

### Key Files

- `apps/web/vite.config.ts` — The only file that needs changes. Current `manualChunks` function (lines ~100-110) handles `maplibre`, `recharts`, `sentry`, `motion`. Add conditions for `date-fns`, `@radix-ui`, `@supabase`. The existing pattern is:
  ```
  if (id.includes("date-fns")) return "date-fns"
  if (id.includes("@radix-ui")) return "radix-ui"
  if (id.includes("@supabase")) return "supabase"
  ```
- `tests/guards/web-bundle-budget.test.mjs` — The existing bundle budget guard. It checks:
  1. Total preload budget (≤1MB for all `<link rel="modulepreload">` chunks combined)
  2. Forbidden preload patterns (maplibre, recharts, sentry must not be preloaded)
  
  **Important:** The guard does NOT check individual chunk sizes — it only checks preload budget and forbidden preload patterns. The 500KB warning comes from Vite's built-in `chunkSizeWarningLimit: 500` in the config. So eliminating warnings from the build log is the goal, not failing a guard.

### Current Build Output (from S01)

| Chunk | Size | Status |
|-------|------|--------|
| `maplibre-*.js` | 1,054KB | Exempt — WebGL renderer, cannot split |
| `index-*.js` | 557KB | **Over budget** — needs splitting |
| `recharts-*.js` | 521KB | **Over budget** — already isolated, needs investigation |
| `sentry-*.js` | 467KB | Under 500KB ✅ |
| `client-*.js` | 283KB | Under 500KB ✅ |
| `format-*.js` | 27KB | Fine |
| All route chunks | <57KB each | Fine |

### Libraries to Extract from Index Chunk

Per D003 and confirmed in codebase:
- **date-fns** (`date-fns@4.3.0`) — Used by 10+ files across events, admin, calendar, plan features. Wide usage means it's in the shared index chunk.
- **@radix-ui** — Multiple packages (`react-tabs`, `react-avatar`, `react-dropdown-menu`, `react-tooltip`, `react-portal`, `react-scroll-area`, `react-form`, `react-aspect-ratio`). These are the UI primitives behind shadcn components — heavily used everywhere.
- **@supabase** (`@supabase/supabase-js@2.106.1` + sub-packages: `auth-js`, `realtime-js`, `storage-js`, `functions-js`) — Used by 4 files directly (`client.ts`, `channel-registry.ts`, `auth-store.ts`), but the package includes all sub-modules.

### Recharts Investigation

Recharts v3.8.1 is at 521KB. It's already isolated in its own chunk and already excluded from modulePreload via the `resolveDependencies` filter (which filters out `/recharts-*.js`). The bundle budget guard also lists `recharts` in `FORBIDDEN_PRELOAD_PATTERNS`. So recharts is:
- Not preloaded on first paint ✅
- Only loaded on admin dashboard (route-lazy) ✅
- 21KB over the 500KB warning limit ⚠️

Options:
1. **Accept the warning** — it's cosmetic; the guard passes, the chunk is lazy-loaded. But `verify:web` includes `web:build` which shows the warning.
2. **Split recharts' d3 deps** — add `if (id.includes("d3-"))` to manualChunks. This would extract d3 sub-packages into a `d3` chunk, reducing recharts below 500KB. d3 is only used by recharts, so the d3 chunk would only load alongside recharts anyway.
3. **Raise chunkSizeWarningLimit** — rejected per D003 alternatives.

Recommendation: Try option 2 (split d3) since it's a one-line addition and keeps all chunks under budget. If d3 splitting causes issues (e.g., recharts doesn't work with externalized d3), fall back to option 1.

### Build Order

1. **Modify `manualChunks` in vite.config.ts** — add date-fns, radix-ui, supabase, and optionally d3 entries.
2. **Run production build** — `pnpm --filter @family-events/web build` — verify no chunk warnings except maplibre.
3. **Run full verify:web** — `pnpm run verify:web` — all 7 steps must pass including the bundle budget guard.

### Verification Approach

- `pnpm --filter @family-events/web build` — build output should show:
  - `index-*.js` < 500KB (was 557KB)
  - `recharts-*.js` < 500KB (was 521KB, if d3 split works)
  - `maplibre-*.js` > 500KB (exempt, expected warning)
  - New chunks: `date-fns-*.js`, `radix-ui-*.js`, `supabase-*.js` (and optionally `d3-*.js`)
- `pnpm run verify:web` — exit code 0, all 7 steps pass
- Check that no new chunks are accidentally preloaded (existing `resolveDependencies` filter should be fine since it only filters known patterns, but verify)

## Constraints

- `chunkSizeWarningLimit` is set to 500 (Rollup default) — any chunk over 500KB emits a build warning
- `maplibre` chunk will always be >500KB — the warning is expected and acceptable
- `modulePreload.resolveDependencies` must continue filtering maplibre, recharts, sentry from first-paint preloads
- New vendor chunks (date-fns, radix-ui, supabase) should NOT be added to the forbidden preload list — they are shared deps needed on first paint
- The bundle budget guard checks total preload size ≤1MB — adding new preloaded chunks could push over this budget. Monitor the total.

## Common Pitfalls

- **Radix-UI naming collision** — `id.includes("@radix-ui")` matches all radix packages. This is correct — we want all radix primitives in one chunk. But verify it doesn't accidentally match a non-radix package with "radix" in the path.
- **Supabase sub-packages** — `@supabase/supabase-js` re-exports from `@supabase/auth-js`, `@supabase/realtime-js`, etc. Make sure the `id.includes("@supabase")` matcher catches all sub-packages, not just the top-level one.
- **Preload budget inflation** — The new date-fns, radix-ui, and supabase chunks will be preloaded (they're shared deps). If total preload exceeds 1MB, the budget guard fails. Need to check: current preload total + new chunks ≤ 1MB.
- **d3 chunk ordering** — If d3 is extracted from recharts, the d3 manualChunks rule must come BEFORE the recharts rule, since both match `node_modules`. Actually, with the current function-based approach, d3 modules would match `id.includes("d3-")` before falling through to the recharts check. Wait — the current recharts match is `id.includes("recharts")` which wouldn't match `d3-*` modules anyway, since d3 packages are `node_modules/d3-shape/`, `node_modules/d3-scale/`, etc. They don't contain "recharts" in the path. So d3 modules currently fall through to `return undefined` and end up in the index chunk... which means d3 is NOT currently in the recharts chunk. Need to verify this with the actual build to understand the real chunk composition.

## Open Risks

- **d3 may already be in the index chunk, not recharts** — If d3 modules don't match the recharts pattern, they'd be in the index chunk. This would mean recharts is ~521KB even without d3 (pure recharts code), making the d3 split useless for recharts. Need a build analysis to confirm. The index chunk being 557KB could include d3 — extracting d3 might reduce both index and be more impactful than expected.
- **Preload budget is 1MB** — current preload total is unknown. If it's already close to 1MB, the new chunks could push it over. The guard would fail on `verify:web`.
