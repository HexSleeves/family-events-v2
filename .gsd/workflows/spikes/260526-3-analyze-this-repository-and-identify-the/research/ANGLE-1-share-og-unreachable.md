# ANGLE 1 — `share-og` edge function is unreachable by social crawlers

**Category:** feature / SEO correctness (with a small security undertone:
the only public preview path bypasses the function's hardening).
**Confidence:** high — verified against checked-in `supabase/config.toml`,
edge function source, SPA router, and the deployed-style `serve.json`.

## Finding

The repo ships a 337-line, fully-tested edge function at
`supabase/functions/share-og/index.ts` that does exactly what it says: take
an event ID, look up the public event row, produce server-rendered HTML
with proper `og:title` / `og:description` / `og:image` tags, and respond
with a tuned `Cache-Control` for crawler CDNs.

It is currently unreachable from production traffic.

Two independent things have to be wrong for it to be unreachable, and both
are wrong:

1. **It is JWT-gated.** `supabase/config.toml` declares
   `[functions.share-og]` with `verify_jwt = true`. Social-card crawlers
   (Facebookbot, Twitterbot, LinkedInBot, Slackbot, Discordbot, iMessage)
   never carry user JWTs — they will receive a 401 from the Supabase
   gateway before the function body ever runs.
2. **The SPA host never proxies crawlers to it.** The web app is served as
   a static SPA (`apps/web/dist/serve.json`):

   ```json
   "rewrites": [
     { "source": "**", "destination": "/index.html" }
   ]
   ```

   So `GET /share/<eventId>` from a crawler returns `index.html`, which
   contains only the **generic** OG tags hard-coded into the head:

   ```html
   <meta property="og:title" content="Family Events Platform" />
   <meta property="og:description" content="Discover, plan, and share local family events." />
   ```

   No crawler-aware routing to `share-og` exists in `serve.json`, in the
   Vite config, in the build output, or anywhere else I can find.

The `PublicEventPreviewPage` (`apps/web/src/features/events/pages/public-event-preview.tsx`)
correctly renders event-specific content **client-side** when a human
opens the URL, but crawlers don't execute JS for OG scraping — they
read the static head only.

## Evidence

- `supabase/config.toml`:
  ```
  [functions.share-og]
  verify_jwt = true
  ```
- `supabase/functions/share-og/index.ts` — full implementation (337 lines)
  including URL parsing, UUID validation, image-URL hardening via
  `validateExternalUrl`, JSON `<script>` escaping, fallback image, and
  CDN cache headers. Tested in `supabase/functions/share-og/index_test.ts`
  (72 lines).
- `apps/web/public/serve.json` and `apps/web/dist/serve.json` — single
  catch-all rewrite to `/index.html`, no per-path routing for `/share/`.
- `apps/web/index.html` (and the built `apps/web/dist/index.html`) —
  hard-coded generic OG tags only.
- `apps/web/src/app/app-router.tsx:58` — the `/share/:eventId` route is
  client-side only:
  `{ path: "/share/:eventId", element: <PublicEventPreviewPage /> },`
- `grep -rn "share-og" apps/web supabase` returns **only** the function
  itself and its tests — no caller, no proxy, no infra wiring.

## Why it matters

This is a closed-beta product whose primary growth loop is "user finds a
neat Saturday event → shares the link in a group chat / on Facebook". Every
one of those previews currently shows the same generic card, regardless of
which event was shared. That is:

- A **direct hit on the primary user loop** (R-class "primary-user-loop"
  in GSD terms). The share button is the demand-side flywheel.
- A **dev-experience trap**: there is well-tested code in the repo that
  looks like it works, so the next engineer to look here will assume
  previews are fine. The function passes its own tests; the
  integration is what's broken.
- A **wasted hardening effort**: the function carefully validates image
  URLs, escapes inline scripts, and tunes CDN cache headers — none of
  which matters if nothing ever calls it.

## Recommended fix

Two small changes — one config edit and one rewrite rule — make the
function reachable. Either alone is insufficient.

1. **Make the function publicly callable.** In `supabase/config.toml`:

   ```toml
   [functions.share-og]
   # Public OG endpoint hit by social crawlers (Facebookbot, Twitterbot,
   # Slackbot, etc.) which never carry user JWTs. App-layer validation
   # already enforces UUID + public-event-only access.
   verify_jwt = false
   ```

   The function already reads from a `public_events` view via the anon
   key; it does not need elevation. The `corsHeaders` allow `GET, OPTIONS`
   only, and `extractEventIdFromRequest` rejects anything that isn't a
   UUID — so opening it to anon does not widen the surface area meaningfully.

2. **Route crawler-style requests on `/share/*` to the function.** The
   pre-launch deploy stack (`serve` on Railway) supports per-path rewrites
   via `serve.json`. Add a rewrite that sends bots to the edge function
   and humans to the SPA. The simplest variant uses a separate path:

   - Change the share URL builder in
     `apps/web/src/features/plan/components/share-event-button.tsx`
     so the canonical share URL is `/share/<id>` (already true), and in
     `apps/web/public/serve.json` add a rewrite from
     `"/share/:eventId"` to the public function URL when the
     `User-Agent` matches a known bot list. (`serve` supports this via
     `headers` + rewrites; if not, the cleaner alternative is to put a
     thin reverse proxy / edge worker — Vercel/Cloudflare/Railway Edge —
     in front of the static host whose only job is bot detection +
     proxy to `share-og`.)

   If the deploy target makes per-UA routing painful, a fallback is to
   render a tiny crawler-specific HTML at `/share/<id>/preview` from the
   edge function and add a `<link rel="alternate">` plus a `<meta http-equiv="refresh">`
   bounce for humans. Not as clean, but fully unblocks SEO/social.

3. **Add a smoke test** that runs in CI and curls the deployed share URL
   with `User-Agent: facebookexternalhit/1.1`, asserting the response
   body contains the event-specific `og:title`. The current
   `index_test.ts` validates the function in isolation; nothing validates
   the integration.

## Pros / cons / risks

**Pros**
- Restores the primary share flow with two small diffs.
- Activates code + tests that already exist.
- No new dependencies, no schema changes, no client refactor.

**Cons / risks**
- Opening `verify_jwt = false` means the function will accept requests
  from anyone, not just Supabase-authenticated clients. Validate the
  function rejects non-UUID inputs and only reads from the public view
  before flipping the flag (it already does — see
  `extractEventIdFromRequest` and the `public_events` select). Add a
  per-IP rate limit at the gateway / Cloudflare / Railway layer to
  prevent it being used as an open redirect for image bandwidth.
- Bot UA sniffing is best-effort. If a UA is missed, that share renders
  generic. Mitigation: ship a follow-up that prerenders for all `/share/`
  paths regardless of UA (since the SPA only uses the path for client
  routing anyway).

## Estimated impact / effort

- **Impact:** high. Every external share currently produces a wrong
  preview; this is one of the few visible user-facing growth surfaces
  at launch.
- **Effort:** low. Config flag flip + one rewrite + one CI smoke check.
  Plausible single-PR slice (~half a day including the CI assertion).
