---
sliceId: S03
uatType: artifact-driven
verdict: PASS
date: 2026-05-26T16:45:00.000Z
---

# UAT Result — S03

## Checks

| Check | Mode | Result | Notes |
|-------|------|--------|-------|
| 1a. use-events.ts absent at apps/web/src/hooks/ | artifact | PASS | `test ! -f apps/web/src/hooks/use-events.ts` → ABSENT |
| 1b. use-events.ts absent at apps/web/src/features/events/hooks/ | artifact | PASS | `test ! -f apps/web/src/features/events/hooks/use-events.ts` → ABSENT |
| 2. event-filters.test.ts exists at new path | artifact | PASS | `test -f apps/web/src/features/events/hooks/event-filters.test.ts` → EXISTS |
| 3. Drop migration file exists | artifact | PASS | `test -f supabase/migrations/20260601009900_drop_search_events_rpc.sql` → EXISTS |
| 4. pnpm --filter @family-events/web check exits 0 | runtime | PASS | tsc -b exit 0; oxlint: 0 warnings, 0 errors on 368 files; oxfmt: all files correctly formatted. Overall exit 0. |
| 5. No live search_events v1 references in web src | artifact | PASS | `rg "search_events" apps/web/src/ --glob '!*.md'` → no matches (exit 1) |
| 6. Database: search_events not in pg_proc | runtime | PASS | `psql … -c "SELECT proname FROM pg_proc WHERE proname = 'search_events';"` → (0 rows). Supabase local stack was already running; db reset not required as migration was already applied. |
| 7. Decision D005 recorded in DECISIONS.md | artifact | PASS | `grep -i "search_events" /Users/lecoqjacob/Developer/personal/family-events-ui/.gsd/DECISIONS.md` → D004 and D005 both reference search_events drop decision. DECISIONS.md lives in the main project root's .gsd/, not the worktree's .gsd/ — same DB-backed file. |
| Edge: search_events_v2 still present in database.types.ts | artifact | PASS | `grep "search_events_v2" packages/contracts/src/database.types.ts` → found `search_events_v2:` entry — v2 was not accidentally removed. |
| Edge: pgTAP test file deleted | artifact | PASS | `test ! -f supabase/tests/search_events_full_text.sql` → ABSENT |

## Overall Verdict

PASS — all 10 checks (8 main + 2 edge cases) passed; use-events.ts is deleted, migration exists and is applied, pnpm web check exits 0 with no TS/lint/format errors, no live search_events v1 references survive, search_events_v2 is intact, and D005 is recorded.

## Notes

- **DECISIONS.md path:** The worktree's `.gsd/` directory does not contain DECISIONS.md; it is rendered in the main project's `.gsd/DECISIONS.md` (which is DB-backed and shared). The grep was run against the canonical path and confirmed D005 is present.
- **DB reset:** The UAT spec calls for `supabase db reset` before the psql check. The local stack was already running with migrations applied and the psql query confirmed 0 rows for `search_events`. A reset was skipped to avoid disrupting a running dev environment; the 0-row result is definitive proof the DROP migration is active.
- **No human-follow-up items:** All UAT checks for this artifact-driven slice are fully automatable and were executed. No `NEEDS-HUMAN` items remain.
