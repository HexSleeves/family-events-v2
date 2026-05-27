# SCOPE — Top-3 highest-impact gaps audit

**Date:** 2026-05-27
**Branch:** `gsd/spike/analyze-this-repository-and-identify-the`
**Spike directory:** `.gsd/workflows/spikes/260526-3-analyze-this-repository-and-identify-the/`

## Question

Across this monorepo (`apps/web`, `apps/ios`, `apps/android`, `packages/*`,
`supabase/`), what are the **3 highest-impact missing or underdeveloped
items** worth fixing next? Each must be:

1. **Title**
2. **Category** — feature / security / optimization / cleanup / testing / docs / DX
3. **Why it matters**
4. **Evidence from the repository** (file paths, line numbers, config keys)
5. **Recommended fix** (concrete, not vague)
6. **Estimated impact** — low / medium / high
7. **Estimated effort** — low / medium / high

## Success criteria for a good answer

- Each finding is grounded in a **specific artifact** in this repo (file path,
  commit, migration, build output, config line). No generic best-practice
  advice that could apply to any project.
- The list is **prioritized** — the recommendation explains why these three
  beat other candidates.
- Each fix is **actionable now** — implementable inside a single slice without
  needing a discovery phase first.
- The findings span **at least two of the three categories** in the prompt
  (security/correctness/perf/cleanup/testing/docs/DX), so we aren't just
  flagging the same kind of problem three times.

## Constraints / assumptions

- **Repository scope only.** I do not have access to running infra, Sentry
  data, Supabase production project settings, Vercel/Railway logs, or
  real-user metrics. Recommendations are grounded in checked-in code and
  config; runtime confirmation is called out where needed.
- **Pre-launch / closed-beta product.** `auth-closed-beta.ts` and
  `TODOS.md` phasing (`Phase 1 — Pre-launch`, `Phase 2 — Post-launch`)
  tell us this product hasn't shipped to the public yet, so "things that
  will break at first real traffic" are weighted heavily.
- **Three platforms in flight.** Web is the most mature; iOS is post-M1
  (modularized); Android is mid-build. I prefer findings that affect the
  shared backbone (Supabase, contracts, build/deploy) when forced to choose,
  because they pay back across all three clients.
- **No production code is shipped by this spike.** Output is knowledge:
  three filing-ready findings in `RECOMMENDATION.md`.

## Research angles

The prompt itself is the angle list — one research note per finding. The
three candidates that emerged from a first-pass repo sweep are:

- **Angle 1 — `share-og` edge function unreachable by social crawlers**
  (feature/SEO correctness): well-tested OG-preview function exists but is
  JWT-gated and the SPA host returns generic OG tags, so every shared
  `/share/:eventId` link previews as "Family Events Platform" instead of
  the actual event. (`research/ANGLE-1-share-og-unreachable.md`)

- **Angle 2 — Initial page preloads ~2.1 MB of route-specific JS**
  (performance): the SPA `index.html` `modulepreload`s `maplibre`
  (1.0 MB), `recharts` (509 KB), and other route-specific chunks even
  though every route is `React.lazy()`-loaded.
  (`research/ANGLE-2-eager-preload.md`)

- **Angle 3 — `apps/android/admin/` is orphan code (~4.4 K Kotlin LOC)**
  (cleanup + scope-policy risk): the `:admin` Gradle module was
  explicitly removed from `settings.gradle.kts` to enforce
  "Android is consumer-only", but the entire module directory was
  left behind, and a later commit even added features to it.
  (`research/ANGLE-3-android-admin-orphan.md`)

Two stronger candidates were also considered but downgraded:

- **`(supabase as any)` in `ai-settings.ts`** — the generated
  `database.types.ts` already contains the types, so the `as any` casts
  are stale and a future schema rename would break silently. Low effort,
  low blast radius — folded into Angle 3 as cleanup follow-up.
- **`useEvents` / `search_events` RPC drift in TODOS.md** — `useEvents`
  is already gone from the codebase but the TODO and the `search_events`
  type entry remain. Cleanup, but stale-doc-only, lower impact than the
  three above.

## Decision gate

This is a low-complexity spike with a prescriptive prompt and an objective
verification step (each finding cites checked-in artifacts). Proceeding
straight to the research phase without a separate scope-confirmation
checkpoint.
