import path from "path"
import { defineConfig } from "vitest/config"

// Vitest runs against plain TS/JS — no React plugin needed for these unit tests
// (no JSX, no DOM). Kept separate from vite.config.ts so dev/build stays lean.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: [
      "src/**/*.test.ts",
      "supabase/functions/**/*.test.ts",
    ],
    exclude: ["node_modules", "dist", ".git"],
  },
})
