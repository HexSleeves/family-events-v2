# S03: Dead Code Removal

**Goal:** Delete the dead useEvents hook test file remnant, DROP the unused search_events RPC from the database, and scrub all references from database.types.ts, scripts/test.sh, the pgTAP test, and collect-db-evidence.sql — leaving the codebase with no dangling dead-code surface and pnpm --filter @family-events/web check fully passing.
**Demo:** src/hooks/use-events.ts is gone. pnpm --filter @family-events/web check passes. A decision is recorded in DECISIONS.md for what happened to search_events.

## Must-Haves

- `apps/web/src/features/events/hooks/use-events.test.ts` is gone; its tests survive as `event-filters.test.ts` under the same directory
- `supabase/migrations/20260601009900_drop_search_events_rpc.sql` exists and `supabase db reset` applies it cleanly
- `search_events` block (lines 2750–2823) removed from `packages/contracts/src/database.types.ts`; `search_events_v2` block untouched
- `supabase/tests/search_events_full_text.sql` deleted; corresponding line removed from `scripts/test.sh`
- `scripts/db/collect-db-evidence.sql` search_events EXPLAIN block commented out
- Decision D004 recorded in DECISIONS.md via gsd_decision_save
- `pnpm --filter @family-events/web check` exits 0
- `SELECT proname FROM pg_proc WHERE proname = 'search_events'` returns 0 rows after reset

## Proof Level

- This slice proves: integration — DROP migration verified by supabase db reset; TypeScript cleanliness proven by pnpm check

## Integration Closure

Upstream surfaces consumed: apps/web/src/features/events/hooks/use-events.test.ts (renamed), packages/contracts/src/database.types.ts (search_events block removed), scripts/test.sh (line 65 removed), scripts/db/collect-db-evidence.sql (EXPLAIN block commented out), supabase/tests/search_events_full_text.sql (deleted). New wiring: supabase/migrations/20260601009900 DROP migration. What remains before milestone is truly done: nothing — S03 is the final cleanup slice and this completes the M001 milestone surface.

## Verification

- No runtime observability impact — this is dead code removal only. Post-reset DB state verifiable via: SELECT proname FROM pg_proc WHERE proname = 'search_events'; (expect 0 rows).

## Tasks

- [x] **T01: Renamed use-events.test.ts → event-filters.test.ts; all 392 web tests pass** `est:15m`
  Why: The file apps/web/src/features/events/hooks/use-events.test.ts is a misnamed remnant — the useEvents hook itself was already deleted. The file's actual content tests matchesAgeFilter and normalizeKeyword from event-filters.ts. Keeping the old name implies the dead hook is alive; renaming clarifies the file's real purpose and avoids confusing future readers.
  - Files: `apps/web/src/features/events/hooks/use-events.test.ts`, `apps/web/src/features/events/hooks/event-filters.test.ts`
  - Verify: test -f apps/web/src/features/events/hooks/event-filters.test.ts && test ! -f apps/web/src/features/events/hooks/use-events.test.ts

- [x] **T02: Wrote DROP migration for search_events RPC, scrubbed all v1 references from database.types.ts, scripts/test.sh, and deleted the pgTAP test file; decision D005 recorded** `est:45m`
  Why: The search_events RPC has zero TypeScript callers in apps/web/src, zero edge function callers, and is superseded by search_events_v2. Leaving it alive means the DB carries dead schema, the TypeScript contract carries dead type bindings, the test runner references a test for a non-existent RPC, and diagnostic scripts call a dropped function. This task removes every trace.
  - Files: `supabase/migrations/20260601009900_drop_search_events_rpc.sql`, `packages/contracts/src/database.types.ts`, `scripts/test.sh`, `scripts/db/collect-db-evidence.sql`
  - Verify: test -f supabase/migrations/20260601009900_drop_search_events_rpc.sql && test ! -f supabase/tests/search_events_full_text.sql

- [x] **T03: All four S03 verification gates passed: pnpm web check exits 0, supabase db reset applies migration 009900 cleanly, pg_proc confirms search_events is gone, and no live search_events references survive in apps/web/src.** `est:20m`
  Why: After T01 and T02, we need machine-verified proof that (a) TypeScript compiles cleanly with the renamed test and removed contract block, (b) ESLint/format passes, and (c) the DROP migration applies without error. This task produces that proof.
  - Verify: pnpm --filter @family-events/web check

## Files Likely Touched

- apps/web/src/features/events/hooks/use-events.test.ts
- apps/web/src/features/events/hooks/event-filters.test.ts
- supabase/migrations/20260601009900_drop_search_events_rpc.sql
- packages/contracts/src/database.types.ts
- scripts/test.sh
- scripts/db/collect-db-evidence.sql
