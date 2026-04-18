import path from "path"
import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { sentryVitePlugin } from "@sentry/vite-plugin"
import { defineConfig } from "vite"

const buildEnv = createEnv({
  server: {
    SENTRY_AUTH_TOKEN: z.string().min(1).optional(),
    SENTRY_ORG: z.string().min(1).optional(),
    SENTRY_PROJECT: z.string().min(1).optional(),
    SENTRY_RELEASE: z.string().min(1).optional(),
    RAILWAY_GIT_COMMIT_SHA: z.string().min(1).optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})

export default defineConfig(({ mode }) => {
  const plugins = [react(), tailwindcss()]

  const release = buildEnv.SENTRY_RELEASE ?? buildEnv.RAILWAY_GIT_COMMIT_SHA

  if (buildEnv.SENTRY_AUTH_TOKEN && buildEnv.SENTRY_ORG && buildEnv.SENTRY_PROJECT && release) {
    plugins.push(
      sentryVitePlugin({
        authToken: buildEnv.SENTRY_AUTH_TOKEN,
        org: buildEnv.SENTRY_ORG,
        project: buildEnv.SENTRY_PROJECT,
        release: {
          name: release,
        },
        sourcemaps: {
          assets: "./dist/**",
          filesToDeleteAfterUpload: ["./dist/**/*.map"],
        },
        telemetry: false,
      })
    )
  }

  return {
    plugins,
    build: {
      sourcemap: mode !== "development",
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  }
})