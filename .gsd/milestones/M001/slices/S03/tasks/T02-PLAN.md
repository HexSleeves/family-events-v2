---
estimated_steps: 38
estimated_files: 4
skills_used: []
---

# T02: Wrote DROP migration for search_events RPC, scrubbed all v1 references from database.types.ts, scripts/test.sh, and deleted the pgTAP test file; decision D005 recorded

Why: The search_events RPC has zero TypeScript callers in apps/web/src, zero edge function callers, and is superseded by search_events_v2. Leaving it alive means the DB carries dead schema, the TypeScript contract carries dead type bindings, the test runner references a test for a non-existent RPC, and diagnostic scripts call a dropped function. This task removes every trace.

Do:

1. Write supabase/migrations/20260601009900_drop_search_events_rpc.sql with the following content:

```sql
-- Drop the legacy search_events RPC (v1).
-- This function has zero callers in apps/web/src, zero edge function callers,
-- and is superseded by search_events_v2 (cursor-based pagination).
-- See DECISIONS.md D004 for rationale.

BEGIN;

REVOKE ALL ON FUNCTION public.search_events FROM anon, authenticated;

DROP FUNCTION IF EXISTS public.search_events(
  p_city_id   uuid,
  p_date_from timestamptz,
  p_date_to   timestamptz,
  p_age_min   int,
  p_age_max   int,
  p_is_free   boolean,
  p_is_featured boolean,
  p_tag_slugs text[],
  p_keyword   text,
  p_status    text,
  p_limit     int,
  p_offset    int
);

COMMIT;
```

2. Edit packages/contracts/src/database.types.ts — remove the search_events block. The block starts at the line containing `search_events: {` (line ~2750) and ends just before `search_events_v2: {` (line ~2824). The exact text to remove is the `search_events: { ... }` entry including its closing `}` and trailing newline, up to but NOT including the `search_events_v2:` entry. Use the read tool to inspect the exact lines 2748–2826, confirm the boundary precisely, then use the edit tool to remove only the search_events block while leaving search_events_v2 and all surrounding content intact.

3. Edit scripts/test.sh — remove the line `  supabase/tests/search_events_full_text.sql` (line 65). Use the read tool to see lines 63–67 for exact whitespace, then edit to remove only that one line.

4. Delete supabase/tests/search_events_full_text.sql (84-line pgTAP test). Use bash to confirm deletion: `rm supabase/tests/search_events_full_text.sql`.

5. Edit scripts/db/collect-db-evidence.sql — the search_events EXPLAIN block at lines ~115–120 is already inside a block comment (`/* ... */`) per inspection. Verify via read tool whether the block is already commented out. If the search_events EXPLAIN is inside the block comment, leave it (it cannot execute). If it is NOT inside a comment, wrap just the search_events EXPLAIN lines in `/* ... */`.

6. Call gsd_decision_save to record D004:
   - scope: architecture
   - decision: Fate of the search_events RPC in the database
   - choice: Deleted via DROP migration — not wired into any new TypeScript caller
   - rationale: Zero callers in apps/web/src, zero callers in edge functions or cron scripts. search_events_v2 covers the cursor-based path and is the canonical RPC. The v1 function carries dead schema surface with no upgrade path worth implementing at current state.
   - made_by: agent
   - revisable: No — search_events_v2 is the migration path; v1 has no unique functionality worth restoring.

Done when: migration 009900 exists, search_events block is absent from database.types.ts (grep returns no match for 'search_events:' in that file except search_events_v2), scripts/test.sh no longer references search_events_full_text.sql, the pgTAP test file is deleted, and D004 is persisted in DECISIONS.md.

## Inputs

- `supabase/migrations/20260601009800_enrichment_geocodable_address_expand_2.sql`
- `packages/contracts/src/database.types.ts`
- `scripts/test.sh`
- `scripts/db/collect-db-evidence.sql`
- `supabase/tests/search_events_full_text.sql`
- `supabase/rollbacks/20260601000300_004_views_and_rpcs_down.sql`

## Expected Output

- `supabase/migrations/20260601009900_drop_search_events_rpc.sql`

## Verification

test -f supabase/migrations/20260601009900_drop_search_events_rpc.sql && test ! -f supabase/tests/search_events_full_text.sql
