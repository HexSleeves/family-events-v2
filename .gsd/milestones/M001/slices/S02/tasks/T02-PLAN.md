---
estimated_steps: 12
estimated_files: 1
skills_used: []
---

# T02: supabase db reset exited 0 applying 009800 migration; pre/post diagnostic counts recorded (newly_eligible: 0→0 on sparse seed, no SQL errors)

**Why:** The slice success criterion requires `supabase db reset` to apply the new migration cleanly (exit code 0) and the diagnostic SQL to show the newly-eligible count is ≥ the 009700 baseline. This task proves the migration is syntactically and semantically valid against the real local Supabase stack.

**Do:**
1. Before resetting, run the `newly_eligible` diagnostic query against the current local DB to capture the 009700 baseline count. Use `supabase db query` or `psql` with the query from the migration comment.
2. Run `supabase db reset` — this applies all migrations (including 009800) plus re-seeds.
3. After reset, run the `newly_eligible` diagnostic query again to capture the post-migration count.
4. Record both counts (before and after) in the task SUMMARY so milestone validation has the numbers. A zero delta on sparse seed data is acceptable; the query must run without SQL error.
5. Optionally run `supabase db diff` and confirm only function changes appear — no table schema drift.

**Constraints:**
- Do NOT commit or push. This is local verification only.
- If `supabase db reset` fails due to a missing Supabase local stack, document the error in the summary and confirm the migration SQL is syntactically valid by other means (e.g. `psql --file` against a test DB if available).
- The diagnostic queries to use are in the `-- DIAGNOSTIC QUERY` comment block in the migration file created by T01.

**Done when:** `supabase db reset` exits 0 and both diagnostic counts are recorded in the summary.

## Inputs

- `supabase/migrations/20260601009800_enrichment_geocodable_address_expand_2.sql`

## Expected Output

- Update the implementation and proof artifacts needed for this task.

## Verification

supabase db reset
