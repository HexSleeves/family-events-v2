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
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: "react-vendor",
                test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
                priority: 10,
              },
              {
                name: "router-query-vendor",
                test: /node_modules[\\/](@tanstack|react-router|react-router-dom)[\\/]/,
                priority: 9,
              },
              {
                name: "supabase-vendor",
                test: /node_modules[\\/](@supabase)[\\/]/,
                priority: 8,
              },
              {
                name: "sentry-vendor",
                test: /node_modules[\\/](@sentry|@sentry-internal)[\\/]/,
                priority: 8,
              },
              {
                name: "radix-vendor",
                test: /node_modules[\\/](radix-ui|@radix-ui)[\\/]/,
                priority: 7,
              },
              {
                name: "chart-vendor",
                test: /node_modules[\\/](recharts|d3-|victory-vendor|decimal\\.js-light)[\\/]/,
                priority: 7,
              },
              {
                name: "leaflet-vendor",
                test: /node_modules[\\/](leaflet|react-leaflet|@react-leaflet)[\\/]/,
                priority: 7,
              },
              {
                name: "date-vendor",
                test: /node_modules[\\/](date-fns|@date-fns)[\\/]/,
                priority: 6,
              },
              {
                name: "ui-vendor",
                test: /node_modules[\\/](lucide-react|cmdk|vaul|embla-carousel|input-otp)[\\/]/,
                priority: 6,
              },
            ],
          },
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  }
})
