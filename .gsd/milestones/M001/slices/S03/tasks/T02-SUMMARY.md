---
id: T02
parent: S03
milestone: M001
key_files:
  - supabase/migrations/20260601009900_drop_search_events_rpc.sql
  - packages/contracts/src/database.types.ts
  - scripts/test.sh
  - scripts/db/collect-db-evidence.sql
key_decisions:
  - Decision D004 recorded: search_events RPC deleted via DROP migration — zero callers, superseded by search_events_v2
duration: 
verification_result: passed
completed_at: 2026-05-26T16:54:22.812Z
blocker_discovered: false
---

# T02: Verified DROP migration for search_events RPC, database.types.ts scrub, scripts/test.sh cleanup, pgTAP test deletion, and collect-db-evidence.sql comment — all already applied; decision D004 recorded; pnpm check passes.

**Verified DROP migration for search_events RPC, database.types.ts scrub, scripts/test.sh cleanup, pgTAP test deletion, and collect-db-evidence.sql comment — all already applied; decision D004 recorded; pnpm check passes.**

## What Happened

All five cleanup steps were already applied before this task execution ran:

1. **Migration file** `supabase/migrations/20260601009900_drop_search_events_rpc.sql` exists with the correct REVOKE + DROP FUNCTION IF EXISTS content inside a BEGIN/COMMIT transaction.

2. **database.types.ts** — `grep -n 'search_events:'` returns no match; the search_events block has been removed while search_events_v2 remains intact.

3. **scripts/test.sh** — no reference to `search_events_full_text.sql` in the TEST_FILES array.

4. **supabase/tests/search_events_full_text.sql** — file does not exist (already deleted).

5. **scripts/db/collect-db-evidence.sql** — the search_events EXPLAIN block at lines ~116–120 is already wrapped inside a `/* ... */` block comment and cannot execute.

6. **DECISIONS.md** — both D004 and D005 entries are present recording the search_events RPC deletion rationale.

`pnpm --filter @family-events/web check` ran in 4.9 s with 0 warnings and 0 errors (oxlint + oxfmt on 368/371 files).

## Verification

Ran four shell assertions confirming migration exists, pgTAP test absent, search_events: absent from types, test.sh clean. Then ran pnpm --filter @family-events/web check → exit 0, 0 warnings, 0 errors.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `test -f supabase/migrations/20260601009900_drop_search_events_rpc.sql` | 0 | ✅ pass | 5ms |
| 2 | `test ! -f supabase/tests/search_events_full_text.sql` | 0 | ✅ pass | 3ms |
| 3 | `grep -q 'search_events:' packages/contracts/src/database.types.ts` | 1 | ✅ pass — absent | 10ms |
| 4 | `grep -q 'search_events_full_text' scripts/test.sh` | 1 | ✅ pass — absent | 5ms |
| 5 | `pnpm --filter @family-events/web check` | 0 | ✅ pass — 0 warnings, 0 errors | 4868ms |

## Deviations

None. All work was pre-applied; task verified correct state and confirmed pnpm check passes.

## Known Issues

None.

## Files Created/Modified

- `supabase/migrations/20260601009900_drop_search_events_rpc.sql`
- `packages/contracts/src/database.types.ts`
- `scripts/test.sh`
- `scripts/db/collect-db-evidence.sql`
