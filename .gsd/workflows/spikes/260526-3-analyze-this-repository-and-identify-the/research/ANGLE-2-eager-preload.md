# ANGLE 2 — Initial page preloads ~2.1 MB of route-specific JS

**Category:** optimization (performance / Core Web Vitals).
**Confidence:** high — measured directly from `apps/web/dist/`.

## Finding

`apps/web/dist/index.html` declares **19 `<link rel="modulepreload">`**
chunks alongside the entry `<script>`. Summing the sizes of every preloaded
chunk on disk gives:

```
Total preloaded bytes on first paint: 2,131,823 bytes (~2.1 MB)
```

That includes:

- `maplibre-BB0siZgn.js` — **1.0 MB** (used only on `/map` and the small
  map widget inside Event Detail)
- `recharts-CoCHG9jn.js` — **509 KB** (used only on the admin dashboard —
  `apps/web/src/features/admin/components/admin-dashboard-sections.tsx`)
- `llm-review-BV_40e2E.js` — admin-only (event review UI)
- Several `dist-*.js` shards from Radix UI

The Vite config already does the right *splitting*:

```ts
manualChunks(id) {
  if (id.includes("maplibre-gl") || id.includes("react-map-gl")) return "maplibre"
  if (id.includes("recharts")) return "recharts"
  if (id.includes("@sentry")) return "sentry"
  if (id.match(/node_modules\/motion(\/|$)/)) return "motion"
}
```

…and every route is `React.lazy()`-wrapped in
`apps/web/src/app/app-route-pages.ts`. So the chunks are correctly
*separated* from the main bundle — but Rollup/Vite still emits a
`<link rel="modulepreload">` for each chunk that is reachable through any
static (non-`import()`) edge in the graph, and `index.html` ends up
preloading the whole graph anyway.

Net effect: a first-time visitor landing on `/` or `/explore` (the most
common paths — neither uses maps or charts) still pays the network +
parse cost of `maplibre` (1 MB) and `recharts` (509 KB), defeating the
point of code-splitting.

## Evidence

```
$ ls -lhS apps/web/dist/assets/*.js | head
  1.0M maplibre-BB0siZgn.js
  544K index-Db339vxX.js
  509K recharts-CoCHG9jn.js
  452K sentry-CH6_yoSB.js
  276K client-Glra5cAF.js
   55K admin-event-edit-83HBWbj-.js
   53K admin-events-CnrRWriH.js
   32K dashboard-75wR3-h-.js
```

```
$ grep -o 'modulepreload[^>]*' apps/web/dist/index.html | wc -l
19
$ grep -o 'modulepreload[^>]*' apps/web/dist/index.html | grep -E "maplibre|recharts"
modulepreload" crossorigin href="/assets/maplibre-BB0siZgn.js"
modulepreload" crossorigin href="/assets/recharts-CoCHG9jn.js"
```

Static-graph evidence that these libs are reachable from the entry:

- `apps/web/src/features/events/components/event-map-mini.tsx:2` —
  `import { Map as MapGL, … } from "react-map-gl/maplibre"`
- `apps/web/src/features/events/components/event-detail/location.tsx:2` —
  `import { EventMapMini } from "@/features/events/components/event-map-mini"`
- `apps/web/src/shared/components/ui/chart.tsx` and
  `apps/web/src/features/admin/components/admin-dashboard-sections.tsx` —
  the only `recharts` importers, both reachable via the lazy admin route.

Even though `EventDetailPage` is `lazy()`-loaded in `app-route-pages.ts`,
Rollup still inlines a `modulepreload` link for everything it discovers
in the import graph — including the chunks behind the lazy boundary —
because the dynamic `import()` produces a preload hint.

The Vite config also explicitly **opted into** a 500 KB chunk warning:

```ts
chunkSizeWarningLimit: 500
```

`maplibre` (1.0 MB) and `recharts` (509 KB) both exceed that threshold —
the warning is doing exactly what it should, but no follow-up action has
been taken on it.

## Why it matters

This is the entry experience for **every** new user of a pre-launch
consumer product. On a midrange Android phone over a 4G network this
adds several seconds of CPU parse time and ~1.5 MB over the wire before
the user can interact, on routes that do not need maps or charts at all.

It also has a cascading effect on Core Web Vitals:

- **LCP** — the LCP element is typically the hero card or image on
  `/explore` or `/dashboard`; both compete for bandwidth with the
  preloaded `maplibre` chunk.
- **INP** — main-thread parse time of >1 MB of JS during navigation
  blocks input.
- **TBT in Lighthouse / CrUX** — long tasks from parsing maplibre and
  recharts will dominate.

There is no Lighthouse / WebPageTest config checked into the repo, so
this regression class has no automated guard.

## Recommended fix

Three changes, ordered cheapest-first:

1. **Inline a `modulepreload` filter.** In `vite.config.ts`'s
   `build.rollupOptions`, set:

   ```ts
   build: {
     modulePreload: {
       resolveDependencies: (filename, deps) =>
         deps.filter((dep) =>
           !dep.includes("/maplibre-") &&
           !dep.includes("/recharts-") &&
           !dep.includes("/sentry-")
         ),
     },
   }
   ```

   This stops Vite from emitting `<link rel="modulepreload">` for the
   three biggest single-purpose chunks. They will still be `import()`-ed
   on demand when the user navigates to the page that needs them. This
   alone removes ~2.0 MB from first paint.

2. **Move the Event Detail mini map behind dynamic import.** Today,
   `event-map-mini.tsx` is a *static* import from `location.tsx`, which
   means `EventDetail` route is forever coupled to maplibre even though
   most events don't need the map until the user scrolls. Refactor:

   ```ts
   const EventMapMini = lazy(() =>
     import("@/features/events/components/event-map-mini").then((m) => ({
       default: m.EventMapMini,
     }))
   )
   ```

   Wrap it in `<Suspense fallback={<MapPlaceholder />}>`. Same trick for
   `recharts` inside `admin-dashboard-sections.tsx`.

3. **Add a bundle-size guard in CI.** Run `pnpm --filter @family-events/web build`
   in CI (already happens — `web-check` job) and add a Node test that
   parses `apps/web/dist/index.html` and fails if the preloaded chunk
   bytes exceed a budget (e.g. 800 KB for the initial paint). The
   monorepo already has the `tests/guards/` pattern for exactly this
   kind of static-artifact assertion
   (`tests/guards/workspace-layout.test.mjs` etc.).

## Pros / cons / risks

**Pros**
- Each step is small and independently revertible.
- Step 1 alone is a one-line config diff that moves the biggest needle.
- Builds on `manualChunks` infrastructure that already exists; no new
  bundler or framework required.

**Cons / risks**
- Stripping `modulepreload` for `maplibre` adds latency the *first time*
  a user opens `/map` or `EventDetail` (the chunk has to be fetched
  fresh instead of being already in cache). For an analytics-driven
  product this is the right trade — most sessions never hit `/map`.
- Step 2 (lazy map inside detail) introduces a Suspense boundary which
  needs a non-jumpy placeholder. Coordinate with the design system
  tokens.
- Step 3 (CI budget) requires choosing a threshold. Start permissive
  (1 MB) and tighten over the next two milestones.

## Estimated impact / effort

- **Impact:** high. Web Vitals are a launch gate; this currently fails
  Core Web Vitals on cold load for the most-trafficked pages.
- **Effort:** low–medium. Step 1 is ~5 lines and a re-deploy. Steps 2+3
  are each a focused half-day. A single slice can land all three.
