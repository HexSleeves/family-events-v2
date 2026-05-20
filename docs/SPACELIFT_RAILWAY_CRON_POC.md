# Spacelift Railway Cron POC

This POC keeps Railway as the deployment system and uses Spacelift as an
observe-only control plane for the Railway cron services.

## Covered services

| Service | Config | Schedule | Restart policy | Root | Deployment |
| --- | --- | --- | --- | --- | --- |
| `cron-tag-queue` | `apps/cron-tag-queue/railway.toml` | `* * * * *` | `ON_FAILURE` | `apps/cron-tag-queue` | `SUCCESS` |
| `cron-scrape-sources` | `apps/cron-scrape-sources/railway.toml` | `0 * * * *` | `ON_FAILURE` | `apps/cron-scrape-sources` | `SUCCESS` |
| `cron-db-maintenance` | `apps/cron-db-maintenance/railway.toml` | `15 3 * * *` | `ON_FAILURE` | `apps/cron-db-maintenance` | `SUCCESS` |

The manifest also validates source repo, build builder, Dockerfile path, latest
deployment status, and forbidden latest-deployment instance statuses.

## Local proof

```bash
pnpm run spacelift:poc:test
pnpm run spacelift:poc:validate
pnpm run spacelift:poc:terraform:fixture
pnpm run spacelift:poc:terraform:drift
```

`spacelift:poc:test` uses a fixture. `spacelift:poc:validate` calls the live
Railway CLI for local operator checks. `spacelift:poc:terraform:fixture` proves
the Terraform root without Railway auth. `spacelift:poc:terraform:drift` is
expected to fail and proves mismatch diagnostics for schedule, restart policy,
deployment status, and failed instance state.

The validator intentionally avoids `railway variable list` because Railway JSON
and KV variable output include raw secret values.

## Spacelift setup

Create one stack:

- Name/slug: `family-events-railway-cron-poc`
- Vendor: Terraform
- Project root: `infra/spacelift-railway-cron-poc`
- Autodeploy: disabled
- State: managed by Spacelift
- Runtime config: `.spacelift/config.yml`

Attach a context named `family-events-railway-poc` with these environment
variables:

- `TF_VAR_railway_environment_id`: Railway environment ID to inspect
- `TF_VAR_railway_project_access_token`: write-only Railway project access token

The Terraform root calls Railway GraphQL at
`https://backboard.railway.com/graphql/v2` directly. It also supports
`TF_VAR_railway_bearer_token` for account/workspace API tokens, but the POC uses
the project token path so the Spacelift stack only has read access to this
Railway project/environment.

Attach `infra/spacelift-railway-cron-poc/policies/railway-cron-poc-plan.rego` as
a plan policy. The policy denies tracked applies and deletes; the POC should
only produce proposed-run feedback.

## PR status gate

`.github/workflows/railway-cron-drift.yml` runs the same Terraform guard on PRs
that touch cron, Spacelift, or POC files. The workflow publishes a GitHub status
named `drift guard`; requiring that check on `main` makes Railway drift block
merges instead of only appearing in Spacelift.

## Success criteria

- A PR that does not change Railway cron config produces a passing proposed run.
- A PR that changes covered cron metadata produces a clear mismatch diagnostic
  if live Railway still has the old value.
- A stopped, failed, or crashed latest Railway cron deployment blocks the guard.
- No POC run calls `railway up`, `railway redeploy`, `railway restart`,
  `railway variable list`, or any mutating Railway command.

The Spacelift account does not currently have the OpenTofu vendor enabled, so
the POC stack uses Terraform 1.5.7 with a resource-free root.
