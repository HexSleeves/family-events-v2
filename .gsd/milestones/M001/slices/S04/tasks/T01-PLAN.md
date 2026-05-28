---
estimated_steps: 14
estimated_files: 1
skills_used: []
---

# T01: Extend manualChunks to split oversized vendor chunks below 500KB

**Why:** The production build currently produces three chunks over 500KB: index (~557KB), recharts (~521KB), and maplibre (~1055KB). maplibre is exempt (WebGL renderer). Per D003, we extract date-fns, @radix-ui, and @supabase into dedicated vendor chunks to shrink the index chunk. We also extract d3 sub-packages (used only by recharts) to reduce the recharts chunk.

**Do:**
1. Read the current `manualChunks` function in `apps/web/vite.config.ts` (lines ~118-127).
2. Add four new conditions BEFORE the `return undefined` fallthrough:
   - `if (id.includes('date-fns')) return 'date-fns'`
   - `if (id.includes('@radix-ui')) return 'radix-ui'`
   - `if (id.includes('@supabase')) return 'supabase'`
   - `if (id.includes('d3-')) return 'd3'` — extracts d3 sub-packages from recharts (d3-shape, d3-scale, etc.)
3. Place the `d3-` check BEFORE the `recharts` check so d3 modules don't fall into the recharts chunk.
4. Run `pnpm --filter @family-events/web build` and inspect output chunk sizes.
5. Verify: index chunk <500KB, recharts chunk <500KB (if d3 split is effective), new vendor chunks appear.
6. If recharts stays >500KB even with d3 extracted (meaning d3 was already in the index chunk, not recharts), accept the ~521KB recharts overage — it is route-lazy, not preloaded, and the Vite warning is cosmetic.
7. If preload budget inflates past 1MB due to new preloaded chunks, investigate which new chunks are being preloaded and whether the total is acceptable. The existing `resolveDependencies` filter only blocks maplibre/recharts/sentry — the new vendor chunks (date-fns, radix-ui, supabase) are shared deps expected on first paint.

**Done when:** Production build shows index chunk <500KB. New vendor chunks (date-fns, radix-ui, supabase) appear in build output. The only chunk-size warning is for maplibre (>500KB exempt). If recharts remains slightly over 500KB, that is acceptable provided it is not preloaded.

## Inputs

- `apps/web/vite.config.ts`

## Expected Output

- `apps/web/vite.config.ts`

## Verification

pnpm --filter @family-events/web build

## Observability Impact

None — build-time config only
