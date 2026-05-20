import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  collectRailwayServiceState,
  parseRailwayToml,
  readExpectedCronConfigs,
  validateRailwayCronState,
} from "../scripts/spacelift-railway-cron-poc.mjs"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

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
  assert.deepEqual(config.build, {
    builder: "DOCKERFILE",
  })
})

test("reads expected cron service config from committed railway.toml files", () => {
  const expected = readExpectedCronConfigs(repoRoot)

  assert.deepEqual(
    expected.map((service) => ({
      name: service.name,
      sourceRepo: service.sourceRepo,
      rootDirectory: service.rootDirectory,
      builder: service.builder,
      dockerfilePath: service.dockerfilePath,
      cronSchedule: service.cronSchedule,
      restartPolicyType: service.restartPolicyType,
      requiredLatestDeploymentStatus: service.requiredLatestDeploymentStatus,
    })),
    [
      {
        name: "cron-tag-queue",
        sourceRepo: "HexSleeves/family-events-v2",
        rootDirectory: "apps/cron-tag-queue",
        builder: "DOCKERFILE",
        dockerfilePath: "Dockerfile",
        cronSchedule: "* * * * *",
        restartPolicyType: "ON_FAILURE",
        requiredLatestDeploymentStatus: "SUCCESS",
      },
      {
        name: "cron-scrape-sources",
        sourceRepo: "HexSleeves/family-events-v2",
        rootDirectory: "apps/cron-scrape-sources",
        builder: "DOCKERFILE",
        dockerfilePath: "Dockerfile",
        cronSchedule: "0 * * * *",
        restartPolicyType: "ON_FAILURE",
        requiredLatestDeploymentStatus: "SUCCESS",
      },
      {
        name: "cron-db-maintenance",
        sourceRepo: "HexSleeves/family-events-v2",
        rootDirectory: "apps/cron-db-maintenance",
        builder: "DOCKERFILE",
        dockerfilePath: "Dockerfile",
        cronSchedule: "15 3 * * *",
        restartPolicyType: "ON_FAILURE",
        requiredLatestDeploymentStatus: "SUCCESS",
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
                source: {
                  repo: "HexSleeves/family-events-v2",
                },
                cronSchedule: "* * * * *",
                latestDeployment: {
                  status: "SUCCESS",
                  instances: [{ status: "EXITED" }],
                  meta: {
                    rootDirectory: "apps/cron-tag-queue",
                    serviceManifest: {
                      build: {
                        builder: "RAILPACK",
                        dockerfilePath: "Dockerfile",
                      },
                    },
                    fileServiceManifest: {
                      build: {
                        builder: "DOCKERFILE",
                        dockerfilePath: "Dockerfile",
                      },
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
    sourceRepo: "HexSleeves/family-events-v2",
    rootDirectory: "apps/cron-tag-queue",
    builder: "DOCKERFILE",
    dockerfilePath: "Dockerfile",
    latestDeploymentStatus: "SUCCESS",
    instanceStatuses: ["EXITED"],
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
        source: { repo: "HexSleeves/family-events-v2" },
        restartPolicyType: "ALWAYS",
        latestDeployment: {
          status: "FAILED",
          instances: [{ status: "CRASHED" }],
          meta: {
            rootDirectory: "apps/cron-tag-queue",
            fileServiceManifest: {
              build: {
                builder: "DOCKERFILE",
                dockerfilePath: "Dockerfile",
              },
            },
          },
        },
      },
      {
        name: "cron-scrape-sources",
        cronSchedule: "0 * * * *",
        source: { repo: "HexSleeves/family-events-v2" },
        restartPolicyType: "ON_FAILURE",
        latestDeployment: {
          status: "SUCCESS",
          instances: [{ status: "RUNNING" }],
          meta: {
            rootDirectory: "apps/cron-scrape-sources",
            fileServiceManifest: {
              build: {
                builder: "DOCKERFILE",
                dockerfilePath: "Dockerfile",
              },
            },
          },
        },
      },
      {
        name: "cron-db-maintenance",
        cronSchedule: "15 3 * * *",
        source: { repo: "HexSleeves/family-events-v2" },
        restartPolicyType: "ON_FAILURE",
        latestDeployment: {
          status: "SUCCESS",
          instances: [{ status: "CREATED" }],
          meta: {
            rootDirectory: "apps/cron-db-maintenance",
            fileServiceManifest: {
              build: {
                builder: "DOCKERFILE",
                dockerfilePath: "Dockerfile",
              },
            },
          },
        },
      },
    ],
  }

  const result = validateRailwayCronState(expected, live)

  assert.equal(result.ok, false)
  assert.match(result.diagnostics.join("\n"), /cron-tag-queue: cronSchedule mismatch/)
  assert.match(result.diagnostics.join("\n"), /cron-tag-queue: restartPolicyType mismatch/)
  assert.match(result.diagnostics.join("\n"), /cron-tag-queue: latestDeployment\.status mismatch/)
  assert.match(result.diagnostics.join("\n"), /cron-tag-queue: latestDeployment\.instances include forbidden statuses CRASHED/)
  assert.doesNotMatch(result.diagnostics.join("\n"), /token|secret|password/i)
})
