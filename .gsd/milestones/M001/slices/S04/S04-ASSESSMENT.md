---
sliceId: S04
uatType: artifact-driven
verdict: PASS
date: 2026-05-28T07:15:00.000Z
---

# UAT Result — S04

## Checks

| Check | Mode | Result | Notes |
|-------|------|--------|-------|
| Index chunk is under 500KB | artifact | PASS | `index-BkkxckgG.js` = 476.13 KB, under 500KB threshold |
| Recharts chunk is under 500KB | artifact | PASS | `recharts-CnjzSl84.js` = 457.86 KB, under 500KB threshold |
| Vendor chunks extracted and sized correctly | artifact | PASS | `date-fns-CisF-dz_.js` = 22.91KB, `d3-D-lfWD2F.js` = 62.90KB, `radix-ui-smW-aooC.js` = 122.67KB, `supabase-Buo78xGh.js` = 198.94KB — all present as separate chunks |
| Full verify:web pipeline passes | artifact | PASS | Exit code 0. All 7 steps pass: docs:test (2 pass), workspace:test (52 pass), packages:check (clean), packages:test (42 pass across 4 packages), web:check (implicit pass), web:test (419 pass), web:build (success). Total: 515 tests, 0 failures |
| Bundle preload budget guard passes | artifact | PASS | `web-bundle-budget.test.mjs` included in workspace:test run — 52 pass, 0 fail |
| Maplibre is only >500KB chunk | artifact | PASS | Only `maplibre-BB0siZgn.js` (1054.75 KB) exceeds 500KB. No other chunk triggers the warning |
| d3 extraction order in manualChunks | artifact | PASS | `if (id.includes("d3-")) return "d3"` appears at line 124, before `if (id.includes("recharts")) return "recharts"` at line 125. Comment explicitly documents the ordering rationale |

## Overall Verdict

PASS — All 7 checks pass. Bundle optimization delivers all non-exempt chunks under 500KB, vendor chunks are properly extracted, d3/recharts ordering is correct, and the full verify:web pipeline completes with 515 tests and 0 failures.

## Notes

- The sentry chunk (467.14 KB) is close to the 500KB threshold but within limits
- The maplibre chunk at 1054.75 KB is the only chunk exceeding 500KB, which is expected and acceptable as an inherently large WebGL map renderer
- Build completes in under 1 second (~287ms first run, ~688-769ms during verify:web)
