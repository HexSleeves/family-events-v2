---
id: T01
parent: S04
milestone: M001
key_files:
  - apps/web/vite.config.ts
key_decisions:
  - Placed d3- check before recharts check to extract d3 sub-packages from the recharts bundle
  - New vendor chunks (date-fns, radix-ui, supabase) are not excluded from modulePreload since they are shared deps needed on first paint
duration: 
verification_result: passed
completed_at: 2026-05-28T06:57:44.485Z
blocker_discovered: false
---

# T01: Extended manualChunks to extract date-fns, @radix-ui, @supabase, and d3 into dedicated vendor chunks, reducing index from 557KB to 476KB and recharts from 521KB to 458KB

**Extended manualChunks to extract date-fns, @radix-ui, @supabase, and d3 into dedicated vendor chunks, reducing index from 557KB to 476KB and recharts from 521KB to 458KB**

## What Happened

The production build had three chunks over 500KB: index (~557KB), recharts (~521KB), and maplibre (~1055KB, exempt). Per D003, the goal was to split oversized vendor dependencies into dedicated chunks to get index and recharts under 500KB.

Added four new manualChunks conditions to `apps/web/vite.config.ts`:
1. `d3-` → 'd3' (placed BEFORE recharts check so d3 sub-packages don't fall into recharts bundle)
2. `date-fns` → 'date-fns'
3. `@radix-ui` → 'radix-ui'
4. `@supabase` → 'supabase'

Results after the split:
- **index**: 556.82 KB → 476.13 KB (−80.7 KB, now under 500KB ✅)
- **recharts**: 521.18 KB → 457.86 KB (−63.3 KB, now under 500KB ✅)
- **maplibre**: 1,054.75 KB (unchanged, exempt per D003)
- New chunks: date-fns (23KB), d3 (63KB), radix-ui (123KB), supabase (199KB)

The only remaining chunk-size warning is for maplibre (WebGL renderer, exempt). All new vendor chunks are shared dependencies expected on first paint, so they are not blocked by the modulePreload filter — this is intentional as they serve common routes.

`pnpm run verify:web` passed end-to-end with zero failures (docs:test, workspace:test, packages:check, packages:test, web:check, web:test, web:build).

## Verification

Ran `pnpm --filter @family-events/web build` to verify chunk sizes. index chunk: 476.13KB (<500KB ✅), recharts: 457.86KB (<500KB ✅), maplibre: 1054.75KB (exempt). New vendor chunks appeared: date-fns (22.91KB), d3 (62.90KB), radix-ui (122.67KB), supabase (198.94KB). Ran `pnpm run verify:web` which executes docs:test, workspace:test, packages:check, packages:test, web:check, web:test, web:build — all passed with exit code 0.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `pnpm --filter @family-events/web build` | 0 | ✅ pass — index 476KB, recharts 458KB, both under 500KB; only maplibre warning remains | 21738ms |
| 2 | `pnpm run verify:web` | 0 | ✅ pass — all 7 pipeline steps passed end-to-end | 37158ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `apps/web/vite.config.ts`
