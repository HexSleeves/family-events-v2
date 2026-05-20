#!/bin/sh
set -eu

repo_root="$(cd "$(dirname "$0")/.." && pwd)"

if [ -z "${SPACELIFT_POC_FIXTURE:-}" ]; then
  node "$repo_root/scripts/spacelift-railway-cron-poc.mjs" validate
  exit 0
fi

check_service() {
  service="$1"
  config_path="$2"
  expected_schedule="$3"
  expected_restart="$4"

  config_file="$repo_root/$config_path"
  if [ ! -f "$config_file" ]; then
    echo "$service: missing Railway config $config_path" >&2
    return 1
  fi

  actual_schedule="$(awk '
    /^\[deploy\]$/ { in_deploy = 1; next }
    /^\[/ { in_deploy = 0 }
    in_deploy && $1 == "cronSchedule" {
      value = $0
      sub(/^[^=]*=[[:space:]]*/, "", value)
      gsub(/^"|"$/, "", value)
      print value
    }
  ' "$config_file")"

  actual_restart="$(awk '
    /^\[deploy\]$/ { in_deploy = 1; next }
    /^\[/ { in_deploy = 0 }
    in_deploy && $1 == "restartPolicyType" {
      value = $0
      sub(/^[^=]*=[[:space:]]*/, "", value)
      gsub(/^"|"$/, "", value)
      print value
    }
  ' "$config_file")"

  if [ "$actual_schedule" != "$expected_schedule" ]; then
    echo "$service: committed cronSchedule mismatch: expected \"$expected_schedule\", got \"$actual_schedule\"" >&2
    return 1
  fi
  if [ "$actual_restart" != "$expected_restart" ]; then
    echo "$service: committed restartPolicyType mismatch: expected \"$expected_restart\", got \"$actual_restart\"" >&2
    return 1
  fi

  fixture="$repo_root/$SPACELIFT_POC_FIXTURE"
  if [ ! -f "$fixture" ]; then
    fixture="$SPACELIFT_POC_FIXTURE"
  fi
  if [ ! -f "$fixture" ]; then
    echo "$service: fixture not found: $SPACELIFT_POC_FIXTURE" >&2
    return 1
  fi
  if ! grep -Fq "\"name\": \"$service\"" "$fixture"; then
    echo "$service: fixture missing service" >&2
    return 1
  fi
  if ! grep -Fq "\"cronSchedule\": \"$expected_schedule\"" "$fixture"; then
    echo "$service: fixture missing expected cronSchedule \"$expected_schedule\"" >&2
    return 1
  fi
  if ! grep -Fq "\"restartPolicyType\": \"$expected_restart\"" "$fixture"; then
    echo "$service: fixture missing expected restartPolicyType \"$expected_restart\"" >&2
    return 1
  fi

  echo "$service: ok cronSchedule=\"$expected_schedule\" restartPolicyType=\"$expected_restart\""
}

check_service cron-tag-queue apps/cron-tag-queue/railway.toml '* * * * *' ON_FAILURE
check_service cron-scrape-sources apps/cron-scrape-sources/railway.toml '0 * * * *' ON_FAILURE
check_service cron-db-maintenance apps/cron-db-maintenance/railway.toml '15 3 * * *' ON_FAILURE
