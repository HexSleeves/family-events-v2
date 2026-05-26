---
estimated_steps: 8
estimated_files: 2
skills_used: []
---

# T01: Renamed use-events.test.ts → event-filters.test.ts; all 392 web tests pass

Why: The file apps/web/src/features/events/hooks/use-events.test.ts is a misnamed remnant — the useEvents hook itself was already deleted. The file's actual content tests matchesAgeFilter and normalizeKeyword from event-filters.ts. Keeping the old name implies the dead hook is alive; renaming clarifies the file's real purpose and avoids confusing future readers.

Do:
1. Read the full content of apps/web/src/features/events/hooks/use-events.test.ts.
2. Write that content verbatim to apps/web/src/features/events/hooks/event-filters.test.ts (same directory, new name).
3. Delete apps/web/src/features/events/hooks/use-events.test.ts.
4. Confirm both files resolve correctly: the new file exists, the old file is gone.

Important: do NOT modify the test content — all imports (from @/features/events/lib/event-filters, @/infrastructure/queries/query-keys, vitest) resolve to live, undeleted files and need no changes.

Done when: event-filters.test.ts exists at the hooks path, use-events.test.ts does not exist, and pnpm --filter @family-events/web test exits 0 (all tests pass).

## Inputs

- `apps/web/src/features/events/hooks/use-events.test.ts`
- `apps/web/src/features/events/lib/event-filters.ts`
- `apps/web/src/infrastructure/queries/query-keys.ts`

## Expected Output

- `apps/web/src/features/events/hooks/event-filters.test.ts`

## Verification

test -f apps/web/src/features/events/hooks/event-filters.test.ts && test ! -f apps/web/src/features/events/hooks/use-events.test.ts
