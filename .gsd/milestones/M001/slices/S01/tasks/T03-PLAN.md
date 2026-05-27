---
estimated_steps: 10
estimated_files: 3
skills_used: []
---

# T03: Verify Geocoding Migration and Web Cleanup

**Why:** Confirm geocoding migration was documented correctly and web cleanup (search_events removal) was completed.

**Do:**
1. Check if migration file 20260601009800_enrichment_geocodable_address_expand_2.sql exists
2. If missing, note in validation report that S02 summary references migration but file not found (acceptable for retrospective doc)
3. Search web codebase for search_events references: `grep -r search_events apps/web/src`
4. Verify count is zero (requirement R008 validation)
5. Check database.types.ts does not reference search_events
6. Run web type check: `cd apps/web && pnpm check` to confirm no type errors
7. Complete validation report with geocoding and cleanup findings

**Done when:** Web type check exits 0, search_events references confirmed at 0, geocoding migration status documented, validation report complete

## Inputs

- `apps/web/src`
- `packages/contracts/src/database.types.ts`
- `.gsd/milestones/M001/slices/S01/validation-report.md`

## Expected Output

- `.gsd/milestones/M001/slices/S01/validation-report.md`

## Verification

test -f .gsd/milestones/M001/slices/S01/validation-report.md && grep -q complete .gsd/milestones/M001/slices/S01/validation-report.md
