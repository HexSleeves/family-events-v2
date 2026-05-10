# family-events-v2

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-3tce1spn)

## Environment variables

This project validates client environment variables with [`@t3-oss/env-core`](https://github.com/t3-oss/t3-env). Missing or invalid values fail fast at startup/build time.

Create a `.env.local` file for local development:

```bash
# Replace with your actual Supabase project credentials
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=public-anon-key

# Optional app environment name (defaults to Vite mode)
VITE_APP_ENV=development

# Sentry browser SDK
VITE_SENTRY_DSN=
VITE_SENTRY_RELEASE=
VITE_SENTRY_TRACES_SAMPLE_RATE=0.05
VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE=0
VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE=0
```

## Sentry source map upload (build-time)

To upload source maps during `pnpm build`, set these CI/build variables:

```bash
SENTRY_AUTH_TOKEN=
SENTRY_ORG=
SENTRY_PROJECT=
# Optional explicit release (defaults to RAILWAY_GIT_COMMIT_SHA)
SENTRY_RELEASE=
```

If those variables are not present, the Sentry Vite plugin is skipped and the build still succeeds.
