---
estimated_steps: 11
estimated_files: 4
skills_used: []
---

# T03: All four S03 verification gates passed: pnpm web check exits 0, supabase db reset applies migration 009900 cleanly, pg_proc confirms search_events is gone, and no live search_events references survive in apps/web/src.

Why: After T01 and T02, we need machine-verified proof that (a) TypeScript compiles cleanly with the renamed test and removed contract block, (b) ESLint/format passes, and (c) the DROP migration applies without error. This task produces that proof.

Do:
1. Run `pnpm --filter @family-events/web check` — this runs tsc -b, eslint, and format:check. It must exit 0. If it fails, diagnose and fix: likely a trailing comma or brace issue in database.types.ts (re-read the edit bounds), or a broken import in event-filters.test.ts.
2. Run `supabase db reset` — this replays all migrations including 009900. It must exit 0 with migration 009900 listed in its output.
3. Run a psql query to confirm search_events is gone from pg_proc:
   `psql "postgresql://postgres:postgres@127.0.0.1:55322/postgres" -c "SELECT proname FROM pg_proc WHERE proname = 'search_events';"`
   Expect: 0 rows.
4. Run a grep to confirm no live search_events references remain in web/src (excluding markdown):
   `rg "search_events" apps/web/src/ --glob '!*.md'`
   Expect: no matches (exit 1 from rg means no matches, which is the desired state — note this in output).

Done when: pnpm check exits 0, supabase db reset exits 0 with 009900 applied, psql query returns 0 rows for search_events in pg_proc.

## Inputs

- `apps/web/src/features/events/hooks/event-filters.test.ts`
- `supabase/migrations/20260601009900_drop_search_events_rpc.sql`
- `packages/contracts/src/database.types.ts`
- `scripts/test.sh`

## Expected Output

- Update the implementation and proof artifacts needed for this task.

## Verification

pnpm --filter @family-events/web check
