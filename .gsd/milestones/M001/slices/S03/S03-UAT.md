# S03: Dead Code Removal — UAT

**Milestone:** M001
**Written:** 2026-05-26T16:57:29.802Z

# S03: Dead Code Removal — UAT

**Milestone:** M001
**Written:** 2026-05-26

## UAT Type

- UAT mode: artifact-driven
- Why this mode is sufficient: S03 is dead code removal with no runtime UI surface. Correctness is proven by file-system state (absent files, present migration), TypeScript compile/lint passes, and DB state post-reset. No live user-facing behavior to exercise.

## Preconditions

- Working directory: project root with Supabase CLI available
- `supabase db reset` can run against local Supabase instance
- `pnpm` installed; `@family-events/web` package exists

## Smoke Test

Run `pnpm --filter @family-events/web check` — it must exit 0 with no errors or warnings.

## Test Cases

### 1. use-events.test.ts is gone; event-filters.test.ts exists

1. Run: `test -f apps/web/src/features/events/hooks/event-filters.test.ts`
2. Run: `test ! -f apps/web/src/features/events/hooks/use-events.test.ts`
3. **Expected:** Both commands exit 0.

### 2. DROP migration file exists

1. Run: `test -f supabase/migrations/20260601009900_drop_search_events_rpc.sql`
2. **Expected:** Exit 0.

### 3. pgTAP test file is deleted

1. Run: `test ! -f supabase/tests/search_events_full_text.sql`
2. **Expected:** Exit 0.

### 4. database.types.ts contains no v1 search_events block

1. Run: `grep -c "search_events[^_]" packages/contracts/src/database.types.ts`
2. **Expected:** Exit 1 (no matches) — only `search_events_v2` references should remain.

### 5. No live search_events references in web source

1. Run: `rg "search_events" apps/web/src/ --glob '!*.md'`
2. **Expected:** Exit 1 (no matches).

### 6. TypeScript and ESLint pass

1. Run: `pnpm --filter @family-events/web check`
2. **Expected:** Exit 0, 0 errors, 0 warnings.

### 7. DROP migration applies cleanly in DB

1. Run: `supabase db reset`
2. **Expected:** Exit 0; migration 20260601009900 listed in applied migrations output.

### 8. search_events absent from pg_proc after reset

1. After `supabase db reset`, run:
   `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT proname FROM pg_proc WHERE proname = 'search_events';"`
2. **Expected:** `(0 rows)` — the function no longer exists in the database.

## Edge Cases

### search_events_v2 is untouched

1. Run: `grep -c "search_events_v2" packages/contracts/src/database.types.ts`
2. **Expected:** Exit 0 with count > 0 — `search_events_v2` block remains intact.

### All 392 web tests still pass

1. Run: `pnpm --filter @family-events/web test --run`
2. **Expected:** 41 test files, 392 tests, all pass.

## Failure Signals

- `pnpm check` exits non-zero → TypeScript or ESLint regression introduced
- `use-events.test.ts` still exists → rename not applied
- `search_events` (v1) references found in `database.types.ts` → v1 block not removed
- `supabase db reset` fails → migration has a syntax error or dependency conflict
- `pg_proc` returns 1 row → DROP did not execute or migration not applied

## Not Proven By This UAT

- That `search_events_v2` continues to return correct results at runtime (that is search functionality, not dead-code removal)
- Production DB migration — this UAT only covers local `supabase db reset`
- iOS app behavior — S03 is web/DB only

## Notes for Tester

All changes were pre-applied before task execution; tasks focused on verification. Decision D004 in DECISIONS.md records why search_events was dropped (zero callers, superseded by v2). The only remaining `search_events` string in `database.types.ts` is the `search_events_v2` identifier — this is expected and correct.
