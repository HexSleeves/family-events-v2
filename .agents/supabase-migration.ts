import { AgentDefinition } from './types/agent-definition'

const definition: AgentDefinition = {
  id: 'supabase-migration',
  version: '1.0.0',
  displayName: 'Supabase Migration Specialist',
  spawnerPrompt:
    'Spawn this agent to create, review, or apply Supabase database migrations. ' +
    'Handles SQL migration files, RLS policies, SECURITY DEFINER RPCs, edge functions, and type generation.',
  model: 'anthropic/claude-sonnet-4-6',
  outputMode: 'last_message',
  includeMessageHistory: true,

  toolNames: [
    'read_files',
    'write_file',
    'code_search',
    'run_terminal_command',
    'spawn_agents',
    'end_turn',
  ],
  spawnableAgents: ['codebuff/reviewer@0.0.1', 'codebuff/researcher@0.0.1'],

  inputSchema: {
    prompt: {
      type: 'string',
      description: 'What migration to create, modify, or investigate',
    },
  },

  systemPrompt: `You are a Supabase migration specialist for the family-events monorepo.

CRITICAL CONVENTIONS (never deviate):

1. SECURITY DEFINER RPCs — private body + public wrapper pattern:
   - Author real function as private.<name> with SECURITY DEFINER
   - Author thin public.<name> wrapper as SECURITY INVOKER that SELECTs from private.<name>
   - REVOKE EXECUTE ON FUNCTION public.<name>(...) FROM PUBLIC, anon for admin-only RPCs
   - Reference: supabase/migrations/20260601002100_wrap_security_definer_rpcs.sql

2. Supabase project URL / service-role key in pg_cron or pg_net functions:
   - Read from vault.decrypted_secrets FIRST, then fall back to app.settings.* GUC
   - Supabase Cloud blocks ALTER DATABASE SET app.settings.*, so GUC-only code silently no-ops
   - Reference: supabase/migrations/20260601001700_url_from_vault_fallback.sql

3. Migration file naming: YYYYMMDDHHMMSS_description.sql under supabase/migrations/
4. Always generate a rollback in supabase/rollbacks/ when the migration is destructive
5. After migration changes: run pnpm run db:types to regenerate packages/contracts/src/database.types.ts`,

  instructionsPrompt:
    'For the requested migration task: read existing migrations for context and conventions, ' +
    'check existing RLS policies and function patterns, then create or modify the migration. ' +
    'Follow all SECURITY DEFINER and vault conventions from the system prompt. ' +
    'After writing, suggest running: pnpm run db:migrate && pnpm run db:types',

  stepPrompt: 'Continue working on the migration. Use end_turn when complete.',

  handleSteps: function* ({ prompt }) {
    // Read recent migrations for context
    const { toolResult: migrationList } = yield {
      toolName: 'run_terminal_command',
      input: { command: 'ls supabase/migrations/ | tail -10' },
    }

    // Read the reference migration files for conventions
    yield {
      toolName: 'read_files',
      input: {
        paths: [
          'supabase/migrations/20260601002100_wrap_security_definer_rpcs.sql',
          'supabase/migrations/20260601001700_url_from_vault_fallback.sql',
        ],
      },
    }

    // Search for relevant existing patterns
    if (prompt) {
      yield {
        toolName: 'code_search',
        input: {
          pattern: prompt.split(' ').slice(0, 3).join('|'),
          flags: '-i -l',
        },
      }
    }

    // Let the LLM write the migration
    yield 'STEP_ALL'
  },
}

export default definition
