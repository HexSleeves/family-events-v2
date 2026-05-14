#!/usr/bin/env bash
set -euo pipefail

pnpm run docs:test
pnpm run workspace:test
pnpm run check
pnpm run test
pnpm run build
