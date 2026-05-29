# S04: Bundle Optimization and Final Verification — UAT

**Milestone:** M001
**Written:** 2026-05-28T07:03:38.553Z

# S04: Bundle Optimization and Final Verification — UAT

**Milestone:** M001
**Written:** 2026-05-28

## UAT Type

- UAT mode: artifact-driven
- Why this mode is sufficient: This slice only changes build-time chunk splitting configuration (vite.config.ts manualChunks). No runtime behavior changes. Verification is entirely through build output analysis and CI pipeline execution.

## Preconditions

- All upstream slices (S01, S02, S03) are complete
- Node.js and pnpm are installed
- All dependencies are installed (`pnpm install`)

## Smoke Test

Run `pnpm --filter @family-events/web build` and confirm no chunk exceeds 500KB except maplibre.

## Test Cases

### 1. Index chunk is under 500KB

1. Run `pnpm --filter @family-events/web build`
2. Find the `index-*.js` line in build output
3. **Expected:** Size is under 500KB (measured: 476.13KB)

### 2. Recharts chunk is under 500KB

1. Run `pnpm --filter @family-events/web build`
2. Find the `recharts-*.js` line in build output
3. **Expected:** Size is under 500KB (measured: 457.86KB)

### 3. Vendor chunks are extracted and sized correctly

1. Run `pnpm --filter @family-events/web build`
2. Check for dedicated vendor chunks in output
3. **Expected:** `date-fns-*.js` (~23KB), `d3-*.js` (~63KB), `radix-ui-*.js` (~123KB), `supabase-*.js` (~199KB) all appear as separate chunks

### 4. Full verify:web pipeline passes

1. Run `pnpm run verify:web`
2. **Expected:** All 7 steps pass (docs:test, workspace:test, packages:check, packages:test, web:check, web:test, web:build), exit code 0, 515+ tests with 0 failures

### 5. Bundle preload budget guard passes

1. Run `pnpm run workspace:test` (includes web-bundle-budget.test.mjs)
2. **Expected:** Total preload budget ≤1MB, no forbidden preloads, test passes

## Edge Cases

### Maplibre chunk is the only >500KB warning

1. Run `pnpm --filter @family-events/web build`
2. Check the chunk size warning at the end of build output
3. **Expected:** Only one warning about chunks >500KB, referring to maplibre (~1055KB). No other chunk triggers the warning.

### d3 extraction order in manualChunks

1. Inspect `apps/web/vite.config.ts` manualChunks function
2. **Expected:** The `d3-` module ID check appears before the `recharts` check, ensuring d3 sub-packages are extracted into their own chunk rather than being bundled with recharts.

## Failure Signals

- Any chunk other than maplibre exceeding 500KB in build output
- `pnpm run verify:web` exiting with non-zero code
- Bundle preload budget test failing in workspace:test
- Missing vendor chunks (date-fns, d3, radix-ui, supabase) in build output

## Not Proven By This UAT

- Runtime performance improvement from smaller chunks (would require Lighthouse or real-user metrics)
- Chunk loading behavior in actual browser navigation (would require live runtime testing)
- Impact on cache invalidation patterns when dependencies update

## Notes for Tester

- The maplibre chunk warning is expected and acceptable — it's an inherently large WebGL map renderer
- The sentry chunk (467KB) is close to 500KB but within limits; monitor on future dependency updates
- All verification is reproducible via `pnpm run verify:web` which runs the complete pipeline
