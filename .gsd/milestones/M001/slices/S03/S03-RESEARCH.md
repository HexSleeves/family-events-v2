# S03: Dead Code Removal — Research

**Date:** 2026-05-26
**Depth:** Light research — known codebase, straightforward deletion with known patterns.

## Summary

The `useEvents` hook source file (`use-events.ts`) has already been deleted from the repository — it does not appear in HEAD at any path. What remains is `apps/web/src/features/events/hooks/use-events.test.ts`, which is a **misnamed test file**: it imports from `event-filters.ts` (not from the deleted hook) and tests `matchesAgeFilter` and `normalizeKeyword`. These tests are live and valuable; the file just carries the wrong name.

The `search_events` RPC exists in the database via the consolidated schema migration (`20260601000000`) and was hardened in `20260601006800`. It has zero TypeScript callers in `apps/web/src/` and zero callers in edge functions or cron scripts. A complete `DROP FUNCTION` migration is needed, along with removal of the matching test SQL, the `database.types.ts` contract entry, a test runner reference, and a diagnostic script reference.

`pnpm --filter @family-events/web check` runs `tsc -b && eslint && format:check`. The tsconfig includes `src/` (which covers `.test.ts` files) and enforces `noUnusedLocals`/`noUnusedParameters`. The renamed test file will type-check cleanly as long as its imports remain valid — which they will after rename since all imports resolve to live files.

## Recommendation

**Delete the misnamed `use-events.test.ts`, re-home its tests as `event-filters.test.ts`, write a DROP migration for `search_events`, and clean up all references.** Record the fate of `search_events` in DECISIONS.md.

Do NOT simply delete the test file outright — the tests inside are testing live, used logic (`matchesAgeFilter`, `normalizeKeyword`) and should survive under the correct name.

Do NOT add a `search_events_v2` drop — that RPC is referenced in `database.types.ts` and may be wired elsewhere; it is out of scope.

## Implementation Landscape

### Key Files

**To rename:**
- `apps/web/src/features/events/hooks/use-events.test.ts` → `apps/web/src/features/events/hooks/event-filters.test.ts`
  — currently tests `matchesAgeFilter` and `normalizeKeyword` from `event-filters.ts`; rename clarifies purpose

**To write (new):**
- `supabase/migrations/20260601009900_drop_search_events_rpc.sql`
  — `DROP FUNCTION IF EXISTS public.search_events(uuid, timestamptz, timestamptz, int, int, boolean, boolean, text[], text, text, int, int);` plus `REVOKE` and comment documenting why it's dropped

**To edit:**
- `packages/contracts/src/database.types.ts` — remove the `search_events` block (lines ~2750–2823); leave `search_events_v2` untouched
- `scripts/test.sh` — remove `supabase/tests/search_events_full_text.sql` from the test list (line 65)
- `scripts/db/collect-db-evidence.sql` — remove or comment out the `SELECT * FROM public.search_events(...)` diagnostic call (~line 116–118)

**To delete:**
- `supabase/tests/search_events_full_text.sql` — 84-line pgTAP test for the RPC being dropped

**To update (DECISIONS.md):**
- Record D004: `search_events` RPC fate — chose "deleted, not wired"; rationale: zero callers in all surfaces, `search_events_v2` covers the cursor-based path, dead code has no upgrade path worth implementing.

### Build Order

1. **Rename test file first** (`use-events.test.ts` → `event-filters.test.ts`) — proves the file has no import on the dead hook and tests pass before any DB changes.
2. **Write the DROP migration** — straightforward `DROP FUNCTION IF EXISTS`; wrap in `BEGIN/COMMIT`; include comment referencing DECISIONS.md rationale.
3. **Clean up database.types.ts** — remove the `search_events` block; leave `search_events_v2` and all other entries intact.
4. **Remove the test SQL and test runner reference** (`supabase/tests/search_events_full_text.sql` + line in `scripts/test.sh`).
5. **Clean up collect-db-evidence.sql** — remove or comment the dead `search_events` call.
6. **Record DECISIONS.md entry** via `gsd_decision_save`.
7. **Verify** `pnpm --filter @family-events/web check` and `supabase db reset` pass.

### Verification Approach

```bash
# 1. TypeScript check passes — no broken imports, no unused locals
pnpm --filter @family-events/web check

# 2. Migration applies cleanly
supabase db reset

# 3. Confirm search_events is gone from DB
psql "postgresql://postgres:postgres@127.0.0.1:55322/postgres" \
  -c "SELECT proname FROM pg_proc WHERE proname = 'search_events';"
# expect: 0 rows

# 4. No remaining search_events references in web/src
rg "search_events" apps/web/src/ --glob "!*.md"
# expect: no matches

# 5. Vitest still passes for renamed test
pnpm --filter @family-events/web test
```

## Constraints

- `database.types.ts` in `packages/contracts/src/` is the TypeScript source of truth for DB types. Removing the `search_events` block must leave the file valid (no trailing comma issues, braces balanced).
- `scripts/test.sh` references `search_events_full_text.sql` directly by path; both the file reference and the file itself must be removed together or the runner will error.
- TypeScript `noUnusedLocals`/`noUnusedParameters` is enforced — any leftover import of a deleted symbol will fail `tsc -b`.
- `supabase/rollbacks/20260601000300_004_views_and_rpcs_down.sql` already has `DROP FUNCTION IF EXISTS public.search_events(...)` — the new DROP migration is consistent with the rollback strategy.

## Common Pitfalls

- **Leaving `use-events.test.ts` in place** — the file name suggests the hook is still alive. Rename it so future code archaeology is clean.
- **Deleting the test file without re-homing its tests** — `matchesAgeFilter` and `normalizeKeyword` tests are valuable coverage for `event-filters.ts`; they should survive under the correct filename.
- **Removing `search_events_v2` by mistake** — the two RPCs are adjacent in `database.types.ts`; only remove the `search_events` block, not `search_events_v2` (line ~2824+).
- **Forgetting `collect-db-evidence.sql`** — this script calls `search_events` directly; it will error after the DROP if not updated.
