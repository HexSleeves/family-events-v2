import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import {
  collectRailwayServiceState,
  parseRailwayToml,
  readExpectedCronConfigs,
  validateRailwayCronState,
} from "../scripts/spacelift-railway-cron-poc.mjs"

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")

test("parses Railway deploy settings from TOML", () => {
  const config = parseRailwayToml(`
    [build]
    builder = "DOCKERFILE"

    [deploy]
    cronSchedule = "15 3 * * *" # local maintenance window
    restartPolicyType = "ON_FAILURE"
  `)

  assert.deepEqual(config.deploy, {
    cronSchedule: "15 3 * * *",
    restartPolicyType: "ON_FAILURE",
  })
})

test("reads expected cron service config from committed railway.toml files", () => {
  const expected = readExpectedCronConfigs(repoRoot)

  assert.deepEqual(
    expected.map((service) => ({
      name: service.name,
      cronSchedule: service.cronSchedule,
      restartPolicyType: service.restartPolicyType,
    })),
    [
      {
        name: "cron-tag-queue",
        cronSchedule: "* * * * *",
        restartPolicyType: "ON_FAILURE",
      },
      {
        name: "cron-scrape-sources",
        cronSchedule: "0 * * * *",
        restartPolicyType: "ON_FAILURE",
      },
      {
        name: "cron-db-maintenance",
        cronSchedule: "15 3 * * *",
        restartPolicyType: "ON_FAILURE",
      },
    ]
  )
})

test("extracts live Railway service metadata from nested JSON without reading secrets", () => {
  const live = {
    data: {
      environment: {
        serviceInstances: {
          edges: [
            {
              node: {
                serviceName: "cron-tag-queue-seKl",
                variables: {
                  RAILWAY_TOKEN: "do-not-read",
                },
                cronSchedule: "* * * * *",
                latestDeployment: {
                  meta: {
                    serviceManifest: {
                      deploy: {
                        restartPolicyType: "ON_FAILURE",
                      },
                    },
                  },
                },
              },
            },
          ],
        },
      },
    },
  }

  assert.deepEqual(collectRailwayServiceState("cron-tag-queue", live), {
    cronSchedule: "* * * * *",
    restartPolicyType: "ON_FAILURE",
  })
})

test("passes when live Railway metadata matches committed config", () => {
  const expected = readExpectedCronConfigs(repoRoot)
  const live = JSON.parse(
    readFileSync(path.join(repoRoot, "tests", "fixtures", "railway-cron-poc-live.json"), "utf8")
  )

  assert.deepEqual(validateRailwayCronState(expected, live), {
    ok: true,
    diagnostics: [],
  })
})

test("fails with minimal diagnostics when Railway metadata drifts", () => {
  const expected = readExpectedCronConfigs(repoRoot)
  const live = {
    services: [
      {
        name: "cron-tag-queue",
        cronSchedule: "*/5 * * * *",
        restartPolicyType: "ALWAYS",
      },
      {
        name: "cron-scrape-sources",
        cronSchedule: "0 * * * *",
        restartPolicyType: "ON_FAILURE",
      },
      {
        name: "cron-db-maintenance",
        cronSchedule: "15 3 * * *",
        restartPolicyType: "ON_FAILURE",
      },
    ],
  }

  const result = validateRailwayCronState(expected, live)

  assert.equal(result.ok, false)
  assert.match(result.diagnostics.join("\n"), /cron-tag-queue: cronSchedule mismatch/)
  assert.match(result.diagnostics.join("\n"), /cron-tag-queue: restartPolicyType mismatch/)
  assert.doesNotMatch(result.diagnostics.join("\n"), /token|secret|password/i)
})
