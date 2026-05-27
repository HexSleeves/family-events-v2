# RECOMMENDATION — Top 3 highest-impact gaps

**Spike:** Top-3 highest-impact gaps audit
**Date:** 2026-05-27
**Branch:** `gsd/spike/analyze-this-repository-and-identify-the`

## Executive summary

I audited the monorepo (`apps/web`, `apps/ios`, `apps/android`,
`packages/*`, `supabase/`) and inspected docs, build output,
`supabase/config.toml`, edge functions, the Vite/React build, and the
Android module graph. Three findings stand out for their **combination
of evidence-grounded specificity, blast radius, and tractability**:
all three can be fixed inside a single small PR each, and all three
directly affect the launch readiness of a pre-launch / closed-beta
product.

The strongest finding is also the most embarrassing one if it ships:
**every external `/share/<eventId>` link currently previews as a generic
"Family Events Platform" card**, because a fully-written, fully-tested
`share-og` edge function is `verify_jwt = true`-gated and the SPA host
never proxies crawlers to it. This is the primary growth surface for a
consumer launch and should land first.

The next two are a **~2.1 MB initial-JS-preload regression** caused by
`<link rel="modulepreload">` short-circuiting the otherwise-careful
`React.lazy()` route splitting, and a **4.4 K-LOC orphan Android admin
module** that quietly violates the documented "Android is consumer-only"
scope policy.

## Comparison matrix

| # | Title | Category | Impact | Effort | Evidence anchor |
|---|---|---|---|---|---|
| 1 | `share-og` edge function unreachable by social crawlers | feature / SEO correctness | **high** | low | `supabase/config.toml [functions.share-og] verify_jwt = true`; `apps/web/public/serve.json` catch-all rewrite; no `share-og` reference in `apps/web/src` |
| 2 | Initial page preloads ~2.1 MB of route-specific JS | optimization (performance) | **high** | low–medium | `apps/web/dist/index.html` has 19 `modulepreload`s totalling 2,131,823 bytes; `maplibre` 1.0 MB and `recharts` 509 KB are unconditionally preloaded |
| 3 | `apps/android/admin/` is orphan code (4,406 LOC) outside the Gradle build | cleanup / scope-policy | medium | low | `grep -c admin apps/android/settings.gradle.kts → 0`; commit `b6f2cbdc feat(admin): enhance event management…` still touches the orphan tree; `tests/guards/android-scope.test.mjs` only scans `ConsumerApiPath.kt` |

Detailed per-finding write-ups: see
`research/ANGLE-1-share-og-unreachable.md`,
`research/ANGLE-2-eager-preload.md`,
`research/ANGLE-3-android-admin-orphan.md`.

## The three findings, in priority order

### 1. `share-og` edge function unreachable by social crawlers

- **Category:** feature / SEO correctness.
- **Why it matters:** Every external share — group chats, Slack,
  Facebook, Twitter, LinkedIn, iMessage — currently previews as the
  same generic card. Sharing is the primary user loop for a
  consumer-events product. Well-tested code that solves this
  (`supabase/functions/share-og/index.ts`, 337 lines + tests) already
  exists and is unreachable.
- **Evidence:**
  - `supabase/config.toml` sets `[functions.share-og] verify_jwt = true`
    — social crawlers never carry user JWTs, so they get 401 from the
    gateway.
  - `apps/web/public/serve.json` has a single catch-all
    `{ "source": "**", "destination": "/index.html" }` — no
    crawler-aware routing.
  - `apps/web/index.html` carries only hard-coded generic OG tags.
  - `grep -rn "share-og" apps/web supabase` finds the function and its
    test, nothing else.
- **Recommended fix:**
  1. Flip `verify_jwt = false` for `share-og` (function already
     validates UUID input and reads only the public-events view).
  2. Add a `serve.json` / edge rewrite that sends bot-UAs on
     `/share/:eventId` to `https://<ref>.functions.supabase.co/share-og/<id>`,
     and humans to `index.html`.
  3. Add a CI smoke test that curls the deployed share URL with
     `User-Agent: facebookexternalhit/1.1` and asserts the event-specific
     `og:title` is present.
- **Impact / effort:** high / low.

### 2. Initial page preloads ~2.1 MB of route-specific JS

- **Category:** optimization (performance / Core Web Vitals).
- **Why it matters:** Every cold-load visitor pays the network + parse
  cost of `maplibre` (1.0 MB) and `recharts` (509 KB) before
  interactivity, on routes (`/`, `/explore`, `/dashboard`) that don't
  use either. This will register as failing Core Web Vitals on
  midrange mobile, which is the target consumer.
- **Evidence:**
  - `apps/web/dist/index.html` emits 19 `<link rel="modulepreload">`
    tags. Summed-on-disk size is **2,131,823 bytes**.
  - Largest preloads: `maplibre-BB0siZgn.js` 1.0 MB, `recharts-CoCHG9jn.js`
    509 KB, `sentry-CH6_yoSB.js` 452 KB, app `index-*.js` 544 KB.
  - `manualChunks` in `apps/web/vite.config.ts` already splits these
    into separate chunks; the routes are already `React.lazy()` in
    `apps/web/src/app/app-route-pages.ts`. The preload hint is what's
    defeating the lazy boundary.
  - `chunkSizeWarningLimit: 500` in the same Vite config is firing for
    both `maplibre` and `recharts` — the warning has been live for a
    while with no action.
- **Recommended fix:**
  1. Add `build.modulePreload.resolveDependencies` in `vite.config.ts`
     to filter out `maplibre`, `recharts`, and `sentry` from
     `<link rel="modulepreload">` emission. (~5 lines.)
  2. Convert `event-map-mini.tsx` to a `lazy()` import inside
     `event-detail/location.tsx`. Do the same for `recharts` in
     `admin-dashboard-sections.tsx`.
  3. Add a `tests/guards/`-style Node test that parses
     `apps/web/dist/index.html` after the web build and fails if the
     summed preload bytes exceed a budget (start at 1 MB, ratchet
     down).
- **Impact / effort:** high / low–medium.

### 3. `apps/android/admin/` is orphan code outside the Gradle build

- **Category:** cleanup / scope-policy.
- **Why it matters:** The "Android is consumer-only" scope policy is
  documented in `README.md`, `apps/android/AGENTS.md`, and a guard
  test — yet `apps/android/admin/` still exists (4,406 LOC), still
  receives feature commits (`feat(admin): enhance event management…`
  after the scope-policy commit), and is **only** kept out of shipping
  builds because someone remembered to drop `":admin"` from
  `settings.gradle.kts`. There is no structural guard against re-adding
  it, and the existing guard test doesn't scan the orphan tree.
- **Evidence:**
  - `grep -c admin apps/android/settings.gradle.kts → 0` (not in the
    build).
  - `git log -p apps/android/settings.gradle.kts` shows the deliberate
    removal of `":admin"`.
  - `git log --oneline -- apps/android/admin/` shows feature work
    landing **after** that removal (commit `b6f2cbdc`).
  - `tests/guards/android-scope.test.mjs` only inspects
    `core/.../ConsumerApiPath.kt`, not the wider tree.
  - `apps/android/admin/SupabaseAdminApi.kt` is 1,161 lines of admin
    API surface, silently drifting from the live server contract.
- **Recommended fix:**
  1. `git rm -r apps/android/admin/` (after confirming product
     intent — recommend Option A in the angle doc).
  2. Extend `tests/guards/android-scope.test.mjs` to fail if any
     `admin` path segment exists anywhere under `apps/android/` (and
     mirror the same guard for `apps/ios/`).
  3. As an attached cleanup, delete the now-redundant
     `(supabase as any).rpc(...)` casts in
     `apps/web/src/features/admin/api/ai-settings.ts` (the generated
     `database.types.ts` already includes the types), and remove the
     stale `useEvents` / `search_events` TODO from `TODOS.md`.
- **Impact / effort:** medium / low.

## Recommendation

Ship all three, in this order:

1. **Finding 1 first** — fixes a launch-blocking user-visible regression
   for the share flow. Smallest diff, biggest user impact.
2. **Finding 2 second** — Core Web Vitals is also a launch gate, and
   the fix is small enough to bundle with the share-og rewrite if
   convenient.
3. **Finding 3 third** — has no end-user effect but locks in a scope
   policy structurally before someone re-adds `":admin"` to
   `settings.gradle.kts` and reintroduces 4 K LOC of admin into Android
   bundles. Do this before more feature commits land on the orphan tree.

### What would change the recommendation

- **If product owners confirm the share-link flow is not a launch
  priority** (e.g. launch is invite-only with no public sharing), demote
  Finding 1 below Finding 2.
- **If a hosted edge layer (Cloudflare / Vercel / Railway Edge) is not
  available**, Finding 1's "rewrite bots to share-og" step requires a
  different solution (e.g. statically prerender per-event preview pages
  during build, or move the SPA to a server-rendered framework). The
  fundamental finding still holds; only the fix changes.
- **If admin on Android is in fact planned for a future milestone**,
  invert Finding 3 to Option B in the angle doc — wire `":admin"` back
  into `settings.gradle.kts`, remove the scope-policy language, and
  re-write the guard.

## Next steps if this recommendation is accepted

- Open one slice per finding under the next milestone. They are
  independent and can be implemented in any order or in parallel.
- For Finding 1: also add a runbook note to
  `docs/RAILWAY_DEPLOY.md` (or wherever the deploy story lives)
  describing how the bot rewrite is configured — the hardest part of
  this fix to debug from production logs is "who is serving the OG
  HTML?", so document it now.
- For Finding 2: pair the bundle-budget guard with a Lighthouse CI
  check (or a checked-in WebPageTest config) so performance regressions
  become loud in PRs, not just at release.
- For Finding 3: confirm with the product owner before deletion;
  worst-case escape valve is an `archive/android-admin-snapshot` tag so
  the code is recoverable from git if it's ever needed.

## Offer — packaging this as a reusable skill

This spike's pattern — *"audit a multi-platform monorepo for top-N
gaps with file-anchored evidence"* — is reusable, but the **specific
findings here are project-specific to family-events** (share-og config,
Vite preload, Android admin module). I would not package it as a
project-local skill — there is no reusable how-to that future agents
would benefit from beyond "read SCOPE.md as a template".

Instead, the recommendation is to append a one-line decision pointer to
`.gsd/DECISIONS.md` referencing this spike directory once any of the
three findings is acted on, so that the audit trail survives the
artifact-cleanup cycle. Example one-liner format:

> *2026-05-27 — Spike `260526-3-analyze-this-repository-and-identify-the`
> identified share-og unreachability, ~2.1 MB eager preload, and
> orphan `apps/android/admin/`. See
> `.gsd/workflows/spikes/260526-3.../RECOMMENDATION.md` for evidence and
> proposed fixes.*
