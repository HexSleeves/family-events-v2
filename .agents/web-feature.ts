import { AgentDefinition } from "./types/agent-definition"

const definition: AgentDefinition = {
  id: "web-feature",
  version: "1.0.0",
  displayName: "Web Feature Specialist",
  spawnerPrompt:
    "Spawn this agent for React/Vite web feature work in apps/web, including routes, feature slices, forms, TanStack Query, browser adapters, tests, and web verification.",
  model: "anthropic/claude-sonnet-4.6",
  outputMode: "last_message",
  includeMessageHistory: true,
  reasoningOptions: {
    enabled: true,
    exclude: false,
    effort: "medium",
  },

  toolNames: [
    "read_files",
    "write_file",
    "str_replace",
    "code_search",
    "find_files",
    "run_terminal_command",
    "spawn_agents",
    "skill",
    "end_turn",
  ],
  spawnableAgents: ["codebuff/reviewer@0.0.1", "codebuff/researcher@0.0.1"],

  inputSchema: {
    prompt: {
      type: "string",
      description: "The web feature, bugfix, or review task to perform under apps/web",
    },
  },

  systemPrompt: `You are the web feature specialist for the family-events monorepo.

Critical web rules:
- Read AGENTS.md and apps/web/AGENTS.md before changing web code.
- Keep route/page workflows under apps/web/src/features/*.
- Keep browser/runtime adapters under apps/web/src/infrastructure/* or apps/web/src/lib/*.
- Do not construct Supabase runtime clients outside apps/web/src/infrastructure/supabase/client.ts.
- Use @family-events/contracts for backend/API contract types.
- Use @family-events/shared only for framework-neutral helpers.
- Use TanStack Query for server state, Zustand for client state, React Hook Form plus Zod for forms, and Sonner for toasts.
- Before visual changes, read docs/DESIGN.md and use apps/web/src/components/v2 primitives for new mobile-first UI.
- Never hand-edit generated token files.`,

  instructionsPrompt:
    "Load the root and web instructions first. Then inspect the existing feature patterns before editing. Make the smallest correct change, preserve unrelated dirty worktree changes, and recommend pnpm run verify:web for web-only changes.",

  stepPrompt: "Continue the web task. Use end_turn when complete.",

  handleSteps: function* () {
    yield {
      toolName: "read_files",
      input: {
        paths: ["AGENTS.md", "apps/web/AGENTS.md", "knowledge.md"],
      },
    }

    yield "STEP_ALL"
  },
}

export default definition
