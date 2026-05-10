# EXECUTE — Saturday Plan Reframe Handoff

> **Audience:** orchestration agent (forge-conductor / staff-engineer / equivalent).
> **Scope:** implement the Saturday Plan reframe in `family-events-ui` from approved
> design + reviewed plan, end-to-end, with full test coverage.
>
> **Do not skip the preconditions.** This document is the authoritative handoff;
> the design doc and test plan it references are the source of truth for behavior.

---

## ROLE

You are an orchestration agent implementing the Saturday Plan reframe for the
`family-events-ui` repo. You have no prior context about this project. Read the
artifacts below before doing anything.

- **Repo:** `/Users/lecoqjacob/Projects/personal/family-events-ui`
- **Base branch:** `main`
- **Feature branch:** create `feat/saturday-plan` before any code change

---

## ARTIFACTS — READ IN THIS ORDER, IN FULL, BEFORE PLANNING

1. **Design doc** (source of truth, includes 12 numbered eng-review decisions):
   `/Users/lecoqjacob/.gstack/projects/HexSleeves-family-events-v2/lecoqjacob-main-design-20260510-110014.md`

2. **Test plan artifact** (consumed by `/qa`, also your test spec):
   `/Users/lecoqjacob/.gstack/projects/HexSleeves-family-events-v2/lecoqjacob-main-eng-review-test-plan-20260510-110014.md`

3. **Project conventions:**
   - `/Users/lecoqjacob/Projects/personal/family-events-ui/CLAUDE.md`
   - `/Users/lecoqjacob/Projects/personal/family-events-ui/AGENTS.md`
   - `/Users/lecoqjacob/Projects/personal/family-events-ui/TODOS.md`

4. **Existing schema you must align against:**
   - `supabase/migrations/20260407154119_001_create_tables.sql`
   - `supabase/migrations/20260420020000_events_enriched.sql`

---

## OWNER PRECONDITION (do NOT skip)

The design doc's "The Assignment" section says: before writing code, the owner
must spend Saturday 8 AM with the **current** app on his phone, time himself
planning a family activity, and write 2 paragraphs about real friction.

**Confirm with the user that this assignment has happened and the reframe still
feels right.** If it hasn't, STOP and instruct the user to do it before you
begin. Do not proceed without explicit go-ahead.

---

## NON-NEGOTIABLE CONSTRAINTS

- **Tech stack:** React 19 + Vite + TypeScript + Supabase (Postgres + Edge
  Functions Deno) + Tailwind v4 + react-query + react-router v7. No new infra
  services. OpenWeather free tier. Nominatim for geocoding (User-Agent header
  + 1 req/s rate limit).
- **Schema column names:** `events.latitude` / `events.longitude`,
  `events.age_min` / `events.age_max`, `profiles.child_age` (integer).
  **Do NOT use** `lat` / `lng` / `min_age` / `max_age` — those names are wrong
  and will not compile.
- **Routing rollout (decision 7A):** the Saturday Plan replaces `DashboardPage`
  at `HOME_PATH`, but `DashboardPage` stays reachable at `/?legacy=1` for two
  weekends. **Do NOT delete** `DashboardPage` or `dashboard-sections.tsx` in
  this PR.
- **All 12 eng-review decisions in the design doc's "Engineering Review
  Decisions" section are binding.** Implement each one. They are: 1B, 2A, 3A,
  4B, 5A, 6A, 7A, 8A, 9A, 10A, 11A, 12A. Read each before writing the matching
  code.
- **Iron-rule regression tests on `useToggleFavorite` are mandatory:**
  - `src/hooks/use-favorites.test.ts` — optimistic flip + rollback + invalidate
  - `e2e/favorite-toggle.spec.ts` — toggle from `/explore`, `/saved`, `/home`
    behaves identically; rapid double-tap deduped
  - `src/pages/my-events.test.tsx` — saved-tab row removal still fires on toggle
- **Test coverage:** full lake. Roughly 47 unit + 12 e2e + 3 critical
  regression + 1 RLS integration. The test plan artifact lists every required
  test.

---

## EXECUTION PLAN (parallelization lanes from design doc)

### Lane A — Migrations + types (independent; blocks D, E, F)

- Migration: `plan_events_for_user` RPC. **Use the schema-aligned SQL from the
  design doc, with the GROUPED AGGREGATE JOIN form per decision 12A — not
  correlated subqueries.** Columns: `events.latitude`, `events.longitude`,
  `events.age_min`, `events.age_max`, `events.is_outdoor`.
- Migration: `ALTER TABLE events ADD COLUMN is_outdoor boolean`.
- Migration: `CREATE VIEW public_events` with whitelisted columns
  (decision 1B); `GRANT SELECT` to `anon`. Whitelisted columns per design doc:
  `id, title, description, start_datetime, end_datetime, timezone, venue_name,
  address, city_id, latitude, longitude, age_min, age_max, price, is_free,
  source_url, source_name, images, recurrence_info, is_featured`.
- Migration: `CREATE EXTENSION IF NOT EXISTS cube; CREATE EXTENSION IF NOT
  EXISTS earthdistance;`
- Run `pnpm db:types` after migrations apply (decision 8A) and commit the
  regenerated `src/lib/database.types.ts`.
- RLS integration test (`supabase/tests/`): anon `SELECT` on `public_events`
  allowed; anon `SELECT` on raw `events` denied.

### Lane B — Scraper (parallel with A)

- `supabase/functions/scrape-source/`: add Nominatim geocoding to populate
  `latitude` / `longitude` on new events. Honor `User-Agent` header and
  1 req/s rate limit.
- Add image validation per decision 2A: HTTPS only, host in allowlist
  (config-driven), HEAD content-length ≤ 2 MB, content-type matching `image/*`.
  Drop invalid URLs at ingest.
- `is_outdoor` derivation: tag-based — presence of tags like `"park"`,
  `"outdoor"`, `"hike"` → `true`; `"museum"`, `"indoor"`, `"library"` →
  `false`; ambiguous → `null`. Apply at scrape time. One-time backfill query
  in the migration.

### Lane C — Edge Function `share-og` (after Lane A)

- File: `supabase/functions/share-og/index.ts` (Deno).
- Reads `public_events` via anon key (RLS applies).
- Renders SSR HTML for **all** requests with full OG meta tags + SPA shell.
  **No User-Agent sniffing** per design doc.
- Headers: `Cache-Control: public, max-age=300, s-maxage=86400` (decision 5A).
- Missing / unpublished / invalid `eventId`: 200 generic OG card +
  `<meta name="robots" content="noindex">`.
- `og:image` rules: validated URL from `images[0]` or `/og-fallback.png`;
  dimensions 1200×630; `twitter:card = summary_large_image`.

### Lane D — Hooks (after Lane A + types regen, parallel with C)

- `src/hooks/use-plan-for-today.ts`: composes geolocation + weather + history
  + RPC; auto-stretches `p_date + 1..+7` if 0 rows (decision 4B); error policy
  per decision 10A table.
- `src/hooks/use-weather.ts`: OpenWeather client, react-query 1h cache, retry
  x2 with backoff, fail silently to `null`.
- `src/hooks/use-geolocation.ts`: browser API + city centroid fallback via
  `cities.latitude` / `cities.longitude` (decision 3A); permission-denied
  silent.
- `src/hooks/use-favorites.ts`: **refactor** `useToggleFavorite` to use
  react-query `onMutate` / `onError` / `onSettled` for optimistic + rollback
  (decision 9A). Delete `favoriteOverrides` usage from `explore.tsx`.
  `dashboard.tsx` legacy path keeps its copy — it dies when `DashboardPage`
  is deleted in a follow-up PR.

### Lane E — Pages, components, routing (after Lane D)

- `src/pages/saturday-plan.tsx` (new)
- `src/pages/public-event-preview.tsx` (new; **outside `<ProtectedRoute>`**)
- `src/components/plan/plan-hero-card.tsx` (new)
- `src/components/plan/plan-thumb-card.tsx` (new)
- `src/components/plan/share-event-button.tsx` (new; `navigator.share` →
  `clipboard.writeText` → manual-copy modal as final fallback)
- `src/components/plan/weather-strip.tsx` (new; renders `date · city.name`
  when weather missing per decision 6A)
- `src/App.tsx`:
  - Route `HOME_PATH` renders `SaturdayPlanPage` by default; `?legacy=1`
    query renders `DashboardPage` (decision 7A).
  - Add public route `/share/:eventId` **outside** `<ProtectedRoute>`.
- `public/og-fallback.png` (1200×630 branded card; create or stub).
- `src/env.ts`: add `VITE_OPENWEATHER_API_KEY` validation.
- `.env.example`: document the new var.

### Lane F — Tests (after C + D + E)

Per the test plan artifact:

- `vitest` for unit
- Deno test for the Edge Function
- `playwright` for e2e
- pgTAP or SQL fixture for RPC ranking branches

**Regression tests are non-negotiable.** All 63+ paths in the test plan get a
test.

---

## INLINE ASCII DIAGRAM REQUIREMENT

Owner has a stated preference for ASCII diagrams in code comments. Add them at:

- The new RPC migration file — score composition diagram (4 weighted terms:
  distance 40%, weather 25%, age 20%, history 15%).
- `supabase/functions/share-og/index.ts` — request → `public_events` → render
  flow with cache + 404 branches.
- `src/hooks/use-plan-for-today.ts` — geo + weather + history + RPC +
  date-stretch composition diagram.

---

## WORKFLOW (mandatory, in order)

1. Read all four artifacts above. Confirm to the user that you've read them
   and that the Saturday-morning assignment was completed.
2. Create branch `feat/saturday-plan` from `main`.
3. Execute **Lane A** and **Lane B** in parallel via worktrees or separate
   sub-agents. Merge both before starting C/D.
4. Execute **Lane C** and **Lane D** in parallel after A. Merge both before
   starting E.
5. Execute **Lane E**. Merge before starting F.
6. Execute **Lane F** (full test suite). Iterate until everything passes.
7. Run `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test &&
   pnpm test:e2e` locally. All must pass.
8. Verify the public share path manually:
   - `curl https://localhost:PORT/share/<real-event-id>` returns OG-tagged HTML.
   - Open same URL in a private window — anonymous preview renders, "Open in
     Family Events" CTA links to `/sign-up`.
   - Send the link via iMessage to a real device — preview card renders with
     image + title + description within iMessage's preview timeout.
9. Verify Saturday Plan happy path on a phone-sized viewport:
   - `/home` renders hero + 2 thumbnails within 2s on simulated 3G.
   - Geolocation grant → weather → ranked cards.
   - Geolocation deny → city centroid → ranked cards (no error toast).
   - Tap "Send to Sarah" → share sheet or clipboard toast.
10. Verify `?legacy=1` still renders the old `DashboardPage` unchanged.
11. Run `/review` (or equivalent) on the diff. Address findings. Iterate.
12. Open a PR titled `feat: Saturday Plan reframe (decisions 1B–12A)` with a
    description that links to the design doc, test plan, and lists the 12
    eng-review decisions implemented.
13. Do **not** merge. Hand the PR back to the owner for the real-Saturday
    smoke test before merge.

---

## STOP CONDITIONS

Stop and surface to the user immediately if:

- The Saturday-morning owner assignment has not been completed.
- A schema column does not exist as the design doc claims (verify
  `cities.latitude` / `cities.longitude` exist; verify `events.images` is
  `jsonb`).
- The RLS integration test fails (anon should NOT be able to SELECT on raw
  `events`).
- Edge Function cold start exceeds iMessage's preview timeout (~5 s) on
  staging — design assumes ~500 ms-1 s; if measurably worse, surface.
- Any decision (1B–12A) is mechanically impossible as specified — stop, name
  the conflict, propose alternatives, ask.
- Test coverage drops below the 63-path bar without an explicit owner
  decision.

---

## DEFINITION OF DONE

- All 12 eng-review decisions implemented and verifiable in the diff.
- Saturday Plan renders on `/home`; legacy fallback works at `/?legacy=1`.
- `/share/:id` works for anonymous visitors with proper RLS, OG tags, cache
  headers, and 404 handling.
- 63+ tests written and passing (47 unit + 12 e2e + 3 regression + 1 RLS
  integration).
- `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` all green.
- ASCII diagrams added at the three locations noted above.
- TODOS.md updated only if new durable items emerged during implementation
  (don't repeat what's already there).
- PR opened, not merged. Owner runs the real-Saturday smoke test before merge.

---

## REFERENCES (quick links)

- Design doc:
  `~/.gstack/projects/HexSleeves-family-events-v2/lecoqjacob-main-design-20260510-110014.md`
- Test plan:
  `~/.gstack/projects/HexSleeves-family-events-v2/lecoqjacob-main-eng-review-test-plan-20260510-110014.md`
- TODOS:
  `./TODOS.md`
- Conventions:
  `./CLAUDE.md`, `./AGENTS.md`
- Schema baseline:
  `./supabase/migrations/20260407154119_001_create_tables.sql`
