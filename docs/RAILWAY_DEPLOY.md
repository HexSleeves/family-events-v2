# Railway Deployment

Deploy the Vite + React frontend to Railway. The Supabase backend stays on
Supabase Cloud — Railway only hosts the web app.

## Architecture

```
┌─────────────────┐        ┌──────────────────┐
│    Railway      │───────▶│  Supabase Cloud  │
│  (Vite + serve) │ HTTPS  │  (DB + Auth +    │
│                 │        │   Edge Functions)│
└─────────────────┘        └──────────────────┘
       ▲
       │ visitors
```

## One-time setup

### 1. Deploy Supabase to production

Supabase Cloud project must exist first (frontend will connect to it).
Follow `supabase/docs/PRODUCTION_SETUP.md` for:
- Push migrations (`supabase db push`)
- Set `app.settings.*` for scheduled scraping
- Bootstrap admin user
- Deploy edge functions

### 2. Create Railway project

```bash
railway login
railway init        # from repo root → create new project
railway link        # link current dir to project (if not done)
```

Or via UI: <https://railway.app/new> → Deploy from GitHub repo.

### 3. Set environment variables in Railway

In Railway dashboard → Variables tab → add:

| Variable | Value | Where from |
|----------|-------|------------|
| `VITE_SUPABASE_URL` | `https://YOUR_REF.supabase.co` | Supabase Dashboard → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | `eyJhb...` | Supabase Dashboard → Settings → API → anon/public |

**Why these matter at build time:** Vite replaces `import.meta.env.VITE_*` at
build, not runtime. Railway passes build-time env vars to Nixpacks, which
bakes them into the bundled JS. If you set them AFTER a build, you must
trigger a new build for changes to take effect.

**Never** set `SERVICE_ROLE_KEY` in Railway — that's a server-only secret,
and the frontend doesn't need it. Edge Functions run on Supabase Cloud with
their own secrets.

### 4. Deploy

Railway auto-deploys on git push to the connected branch. First deploy:

```bash
git push origin main
```

Or trigger manually: `railway up`.

## Build config

Build/start behaviour is defined in `railway.json`:

- **Builder:** Nixpacks (auto-detects pnpm, runs `pnpm install && pnpm build`)
- **Node version:** pinned to 23 via `nixpacks.toml`
- **Start command:** `pnpm start` → `serve -s dist -l $PORT`
  - `-s` = single-page mode (all 404s → `index.html`, needed for React Router)
  - `$PORT` = Railway-injected runtime port

## Custom domain

Railway dashboard → Settings → Domains → Add custom domain. Railway provisions
TLS via Let's Encrypt automatically.

**Update Supabase after setting custom domain:**
1. Supabase Dashboard → Authentication → URL Configuration
2. Site URL = `https://yourdomain.com`
3. Redirect URLs = add `https://yourdomain.com/**` (for OAuth callbacks, magic links)

## Verify

- `https://your-app.up.railway.app/` → loads app
- Sign in with admin credentials → `/admin` loads
- Scrape a source → `source_runs` in Supabase shows `status=success`
- Event detail page → map renders
- Refresh `/map` directly → doesn't 404 (SPA routing works)

## Troubleshooting

**White screen on deploy:**
Check browser devtools console. Usually `VITE_SUPABASE_URL` is undefined →
env var wasn't set before the build ran. Fix: set in Railway → trigger redeploy.

**404 on deep-linked routes (e.g., `/map`):**
`serve` isn't running in SPA mode. Check `start` script in `package.json`
has `-s` flag.

**CORS errors from Supabase:**
Supabase Dashboard → Authentication → URL Configuration → add Railway URL
(both `https://your-app.up.railway.app` and any custom domain) to Redirect URLs.

**Build out of memory:**
Railway's default container is 8GB. Vite + TypeScript on a large tree can
spike. If it fails, add to `nixpacks.toml`:
```toml
[variables]
NODE_OPTIONS = "--max-old-space-size=6144"
```
