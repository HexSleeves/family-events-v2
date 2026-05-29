#!/usr/bin/env bash
set -euo pipefail

if [[ "${FAMILY_EVENTS_SKIP_AGENT_PRE_PUSH:-}" == "1" ]]; then
  echo "Skipping agent pre-push checks because FAMILY_EVENTS_SKIP_AGENT_PRE_PUSH=1."
  exit 0
fi

echo "Running agent pre-push checks: pnpm run verify:workflow"
pnpm run verify:workflow
