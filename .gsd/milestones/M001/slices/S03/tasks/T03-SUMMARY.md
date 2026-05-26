---
id: T03
parent: S03
milestone: M001
key_files:
  - apps/web/src/features/events/hooks/event-filters.test.ts
  - supabase/migrations/20260601009900_drop_search_events_rpc.sql
  - packages/contracts/src/database.types.ts
  - scripts/test.sh
key_decisions:
  - All S03 gates verified: search_events RPC is gone from pg_proc, no references in apps/web/src, and pnpm check is clean — S03 dead-code removal is complete.
duration: 
verification_result: passed
completed_at: 2026-05-26T16:55:56.392Z
blocker_discovered: false
---

# T03: All four S03 verification gates passed: pnpm web check exits 0, db reset applies migration 009900 cleanly, pg_proc confirms search_events is gone (0 rows), and no live search_events references remain in apps/web/src.

**All four S03 verification gates passed: pnpm web check exits 0, db reset applies migration 009900 cleanly, pg_proc confirms search_events is gone (0 rows), and no live search_events references remain in apps/web/src.**

## What Happened

T03 is the pure verification task for S03. All prerequisite code changes were already applied by T01 and T02 — this task ran the four machine-verified proof gates:

1. **Gate 1 — pnpm check**: `pnpm --filter @family-events/web check` (tsc -b, oxlint, oxfmt) exited 0 with 0 warnings, 0 errors across 368 source files and 371 format-checked files. The renamed test file and scrubbed database.types.ts compile cleanly.

2. **Gate 2 — supabase db reset**: Full replay of all migrations including `20260601009900_drop_search_events_rpc.sql` completed in ~25s with no errors. Output explicitly confirmed "Applying migration 20260601009900_drop_search_events_rpc.sql..." and "Finished supabase db reset on branch main."

3. **Gate 3 — pg_proc query**: `SELECT proname FROM pg_proc WHERE proname = 'search_events'` returned 0 rows — the RPC function is fully absent from the live database post-reset.

4. **Gate 4 — rg grep**: `rg "search_events" apps/web/src/ --glob '!*.md'` exited 1 (no matches) — the desired state confirming zero live references to the deleted RPC in the web application source tree.

## Verification

All four gates run and passed in the current session:
- `pnpm --filter @family-events/web check` → exit 0, 0 warnings, 0 errors
- `supabase db reset` → exit 0, migration 20260601009900 applied
- `psql … SELECT proname FROM pg_proc WHERE proname = 'search_events'` → 0 rows
- `rg "search_events" apps/web/src/ --glob '!*.md'` → exit 1 (no matches)

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `pnpm --filter @family-events/web check` | 0 | ✅ pass | 3546ms |
| 2 | `supabase db reset (incl. migration 20260601009900_drop_search_events_rpc.sql)` | 0 | ✅ pass | 25335ms |
| 3 | `psql … SELECT proname FROM pg_proc WHERE proname = 'search_events'` | 0 | ✅ pass — 0 rows returned | 109ms |
| 4 | `rg 'search_events' apps/web/src/ --glob '!*.md'` | 1 | ✅ pass — exit 1 = no matches (desired state) | 64ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `apps/web/src/features/events/hooks/event-filters.test.ts`
- `supabase/migrations/20260601009900_drop_search_events_rpc.sql`
- `packages/contracts/src/database.types.ts`
- `scripts/test.sh`
