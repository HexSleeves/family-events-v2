### Task 1: Add a failing migration contract test for source queue + tagging status changes

**Files:**
- Create: `tests/guards/ingestion-tagging-pipeline-migration.test.mjs`
- Modify: `package.json`

- [ ] Step 1: Create `tests/guards/ingestion-tagging-pipeline-migration.test.mjs` with a node test that asserts a new migration file exists at `supabase/migrations/20260601004100_ingestion_tagging_pipeline_rethink.sql` and that it contains all required SQL identifiers from the spec (`source_scrape_queue`, `source_scrape_queue_status`, `claim_source_scrape_queue_batch`, `reap_stuck_source_scrape_queue_rows`, `release_unstarted_source_scrape_queue_rows`, `source_scrape_queue_summary`, `source_extraction_traces`, `extraction_mode`, `succeeded` in `event_tag_queue_status`, and `run_due_source_scrapes` enqueue semantics).
- [ ] Step 2: Run the failing test: `node --test tests/guards/ingestion-tagging-pipeline-migration.test.mjs`
- [ ] Step 3: Commit: `git commit -m "test: add migration contract for ingestion/tagging rethink"`

### Task 2: Implement the database migration for source queue, extraction mode, and tag queue status semantics

**Files:**
- Create: `supabase/migrations/20260601004100_ingestion_tagging_pipeline_rethink.sql`
- Modify: `apps/web/src/lib/database.types.ts`

- [ ] Step 1: Create `supabase/migrations/20260601004100_ingestion_tagging_pipeline_rethink.sql` with SQL that does all of the following in one transactional migration: create `source_scrape_queue_status` enum; create `source_scrape_queue`; add partial unique active-row index on `(source_id)` for `pending|processing`; add queue claim/reap/release/admin-retry RPCs using `FOR UPDATE SKIP LOCKED`; add `source_scrape_queue_summary` view; add `source_extraction_traces` table + admin-select policy; add `event_sources.extraction_mode` (default `deterministic` with backfill); add `succeeded` to `event_tag_queue_status`; backfill legacy `event_tag_queue` rows from `failed` to `succeeded` when they represent successful processing; update `event_tag_queue_summary` to include `succeeded`; and convert due-scrape RPCs (`run_due_source_scrapes`, `admin_run_due_scrapes`) to enqueue rows instead of invoking inline scrape.
- [ ] Step 2: Regenerate DB types and verify Task 1 test passes: `pnpm run db:types && node --test tests/guards/ingestion-tagging-pipeline-migration.test.mjs`
- [ ] Step 3: Commit: `git commit -m "feat: add source queue and ingestion/tagging rethink migration"`

### Task 3: Add failing extraction pipeline unit tests for deterministic/LLM mode selection and trace payload validation

**Files:**
- Create: `supabase/functions/scrape-source/lib/extraction-pipeline_test.ts`
- Modify: `supabase/functions/scrape-source/lib/types.ts`

- [ ] Step 1: Create `supabase/functions/scrape-source/lib/extraction-pipeline_test.ts` with Deno tests that fail until implementation exists for: extraction mode routing (`deterministic`, `llm`, `deterministic_then_llm`), fallback when deterministic returns zero valid events, invalid LLM payload rejection, and trace payload normalization for `source_extraction_traces` inserts.
- [ ] Step 2: Add new types in `supabase/functions/scrape-source/lib/types.ts` referenced by the tests (`ExtractionMode`, `FetchedArtifact`, `ExtractionAttemptResult`, `ExtractionTraceInsert`) so tests compile but fail on missing logic.
- [ ] Step 3: Commit: `git commit -m "test: add extraction pipeline behavior tests"`

### Task 4: Implement extraction pipeline helpers used by scrape workers

**Files:**
- Create: `supabase/functions/scrape-source/lib/extraction-pipeline.ts`
- Modify: `supabase/functions/scrape-source/lib/types.ts`

- [ ] Step 1: Implement `supabase/functions/scrape-source/lib/extraction-pipeline.ts` with pure helpers for `normalizeFetchedArtifact`, `selectExtractionPlan`, `validateParsedEvents`, and `buildExtractionTraceInsert` exactly matching Task 3 test cases.
- [ ] Step 2: Run tests: `cd supabase/functions && deno test scrape-source/lib/extraction-pipeline_test.ts`
- [ ] Step 3: Commit: `git commit -m "feat: implement extraction pipeline helpers"`

### Task 5: Add failing parser split tests for fetch-vs-extract and processSource run-id ownership

**Files:**
- Create: `supabase/functions/scrape-source/parsers/split-pipeline_test.ts`
- Modify: `supabase/functions/scrape-source/parsers/_lib/types.ts`
- Modify: `supabase/functions/scrape-source/lib/process-source_test.ts`

- [ ] Step 1: Create `supabase/functions/scrape-source/parsers/split-pipeline_test.ts` to assert parser contract is split into `fetchArtifact` and deterministic `extractEvents`, and each source parser returns a reusable fetched artifact shape.
- [ ] Step 2: Extend `supabase/functions/scrape-source/lib/process-source_test.ts` with failing tests proving `processSource` no longer creates `source_runs` internally and instead requires a caller-supplied `runId` and extracted events payload.
- [ ] Step 3: Commit: `git commit -m "test: enforce parser split and processSource run ownership"`

### Task 6: Implement parser split and processSource refactor to consume runId + extraction output

**Files:**
- Modify: `supabase/functions/scrape-source/parsers/_lib/types.ts`
- Modify: `supabase/functions/scrape-source/parsers/index.ts`
- Modify: `supabase/functions/scrape-source/parsers/website.ts`
- Modify: `supabase/functions/scrape-source/parsers/rss.ts`
- Modify: `supabase/functions/scrape-source/parsers/ical.ts`
- Modify: `supabase/functions/scrape-source/parsers/manual.ts`
- Modify: `supabase/functions/scrape-source/parsers/macaroni-kid.ts`
- Modify: `supabase/functions/scrape-source/lib/process-source.ts`
- Modify: `supabase/functions/scrape-source/lib/types.ts`

- [ ] Step 1: Refactor parser interfaces and implementations to expose fetch + deterministic extract paths from one fetched artifact, then refactor `processSource` signature to `processSource(supabase, source, runId, extractionResult)` and remove internal `source_runs` insert logic.
- [ ] Step 2: Run tests: `cd supabase/functions && deno test scrape-source/parsers/split-pipeline_test.ts scrape-source/lib/process-source_test.ts scrape-source/parsers/index_test.ts`
- [ ] Step 3: Commit: `git commit -m "feat: split parser pipeline and refactor processSource inputs"`

### Task 7: Add failing enqueue-only tests for scrape-source and due-source sweep behavior

**Files:**
- Create: `supabase/functions/scrape-source/lib/source-queue_test.ts`
- Modify: `supabase/functions/scrape-due-sources/index.ts`

- [ ] Step 1: Create `supabase/functions/scrape-source/lib/source-queue_test.ts` with failing tests for enqueue idempotency (duplicate active rows collapse), per-source enqueue response shape, sweep enqueue response shape, and enqueue-only behavior (no inline fetch/import).
- [ ] Step 2: Add a failing test case in `supabase/functions/scrape-due-sources/index.ts` sidecar test file (`supabase/functions/scrape-due-sources/index_test.ts`) that expects the function to return queue-enqueue stats from `run_due_source_scrapes`.
- [ ] Step 3: Commit: `git commit -m "test: add enqueue-only scrape-source and sweep behavior tests"`

### Task 8: Implement enqueue-only scrape-source and queue-based due-source sweep

**Files:**
- Create: `supabase/functions/scrape-source/lib/source-queue.ts`
- Modify: `supabase/functions/scrape-source/index.ts`
- Modify: `supabase/functions/scrape-due-sources/index.ts`

- [ ] Step 1: Implement `source-queue.ts` helpers to call queue RPCs and return structured enqueue metadata; update `scrape-source/index.ts` to only enqueue source rows, update source status to pending, and opportunistically POST to `process-source-queue`.
- [ ] Step 2: Update `scrape-due-sources/index.ts` to call the enqueue-oriented `run_due_source_scrapes` RPC and return its counts in the HTTP response body.
- [ ] Step 3: Commit: `git commit -m "feat: convert scrape entrypoints to enqueue-only flow"`

### Task 9: Add failing worker tests for source queue claim/retry/dead-letter/deadline release

**Files:**
- Create: `supabase/functions/process-source-queue/index_test.ts`
- Create: `supabase/functions/process-source-queue/lib/worker_test.ts`

- [ ] Step 1: Create `supabase/functions/process-source-queue/lib/worker_test.ts` with failing pure-function tests for source queue retry schedule (5m, 15m, 60m), fourth-failure dead-letter, and release of claimed-but-unstarted rows before deadline.
- [ ] Step 2: Create `supabase/functions/process-source-queue/index_test.ts` with failing integration-style tests (mocked supabase client) that verify one-row-per-invocation processing, run creation on start, reaper invocation, and queue row linkage to `source_run_id`.
- [ ] Step 3: Commit: `git commit -m "test: add process-source-queue worker behavior tests"`

### Task 10: Implement process-source-queue edge worker and runtime wiring

**Files:**
- Create: `supabase/functions/process-source-queue/index.ts`
- Create: `supabase/functions/process-source-queue/lib/worker.ts`
- Modify: `supabase/config.toml`
- Modify: `scripts/deploy.sh`

- [ ] Step 1: Implement `process-source-queue` edge function with service-role auth, stuck-row reap call, bounded claim RPC call, one-started-row processing, `source_runs` creation + queue row `source_run_id` link, extraction-mode execution path, and unstarted-claim release before deadline.
- [ ] Step 2: Register the function in deployment/runtime config by updating `[functions.process-source-queue] verify_jwt = false` in `supabase/config.toml` and adding `fn: process-source-queue` to `scripts/deploy.sh` single/all function deploy lists.
- [ ] Step 3: Commit: `git commit -m "feat: add process-source-queue worker function"`

### Task 11: Add failing process-tag-queue tests for `succeeded` status and deadline-safe release

**Files:**
- Create: `supabase/functions/process-tag-queue/index_test.ts`
- Modify: `supabase/functions/process-tag-queue/index.ts`

- [ ] Step 1: Create `supabase/functions/process-tag-queue/index_test.ts` with failing tests asserting successful rows transition to `succeeded` (not `failed`) and that claimed-but-unstarted rows are released to `pending` when approaching the wall-clock deadline.
- [ ] Step 2: Add test coverage for preserving existing retry/dead-letter policy for started rows only.
- [ ] Step 3: Commit: `git commit -m "test: cover succeeded tag queue state and deadline release"`

### Task 12: Implement process-tag-queue status and deadline behavior updates

**Files:**
- Modify: `supabase/functions/process-tag-queue/index.ts`

- [ ] Step 1: Update `process-tag-queue/index.ts` to mark successful/benign-skip rows as `succeeded`, invoke unstarted-claim release before deadline, and keep started-row retry/dead logic unchanged.
- [ ] Step 2: Run tests: `cd supabase/functions && deno test process-tag-queue/index_test.ts`
- [ ] Step 3: Commit: `git commit -m "feat: move tag queue success state to succeeded"`

### Task 13: Add failing admin/web/cron tests for new queue surfaces and extraction mode defaults

**Files:**
- Create: `apps/web/src/features/admin/components/admin-logs.test.tsx`
- Modify: `apps/web/src/lib/schemas/admin.test.ts`
- Modify: `tests/railway-cron-poc.test.mjs`

- [ ] Step 1: Extend `apps/web/src/lib/schemas/admin.test.ts` with failing cases for `event_sources.extraction_mode` enum values and `event_tag_queue_status` including `succeeded`.
- [ ] Step 2: Create `apps/web/src/features/admin/components/admin-logs.test.tsx` with failing render tests for dual queue panels (source + tag), dead-letter counts, and retry-action visibility.
- [ ] Step 3: Update `tests/railway-cron-poc.test.mjs` expected cron services list to include `cron-process-source-queue` and run failing tests: `pnpm --filter @family-events/web test -- src/lib/schemas/admin.test.ts src/features/admin/components/admin-logs.test.tsx && node --test tests/railway-cron-poc.test.mjs`
- [ ] Step 4: Commit: `git commit -m "test: add admin and cron coverage for source queue rollout"`

### Task 14: Implement admin source-queue UI/hooks, extraction mode editing defaults, and new Railway cron app wiring

**Files:**
- Create: `apps/web/src/features/admin/hooks/use-admin-source-queue.ts`
- Create: `apps/cron-process-source-queue/Dockerfile`
- Create: `apps/cron-process-source-queue/cron-runner.sh`
- Create: `apps/cron-process-source-queue/package.json`
- Create: `apps/cron-process-source-queue/railway.toml`
- Modify: `apps/web/src/features/admin/pages/admin-logs.tsx`
- Modify: `apps/web/src/features/admin/hooks/use-admin-tag-queue.ts`
- Modify: `apps/web/src/features/admin/hooks/use-admin-sources.ts`
- Modify: `apps/web/src/features/admin/pages/admin-sources.tsx`
- Modify: `apps/web/src/features/admin/components/admin-sources-sections.tsx`
- Modify: `apps/web/src/lib/query-keys.ts`
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/schemas/admin.ts`
- Modify: `apps/web/src/lib/database.types.ts`
- Modify: `packages/contracts/src/database.types.ts`
- Modify: `infra/spacelift-railway-cron-poc/cron-services.json`
- Modify: `scripts/spacelift-railway-cron-poc.mjs`
- Modify: `scripts/sync-cron-runner.sh`
- Modify: `scripts/deploy.sh`

- [ ] Step 1: Implement `use-admin-source-queue.ts` hooks for `source_scrape_queue_summary` + dead rows + retry RPC, wire new query keys, and update `admin-logs.tsx` to render both source/tag queue cards and retry actions for dead rows.
- [ ] Step 2: Add `extraction_mode` to web schemas/types and source create/update flows with defaults required by spec (`deterministic_then_llm` for `website` and `macaronikid`; `deterministic` for `rss`, `ical`, `manual`).
- [ ] Step 3: Create `apps/cron-process-source-queue/*` by mirroring cron app conventions (`cron-runner.sh` + Dockerfile + `railway.toml` minute schedule), then update cron manifests/scripts (`infra/spacelift-railway-cron-poc/cron-services.json`, `scripts/spacelift-railway-cron-poc.mjs`, `scripts/sync-cron-runner.sh`, `scripts/deploy.sh`) to include the new service.
- [ ] Step 4: Run verification commands: `pnpm --filter @family-events/web test -- src/lib/schemas/admin.test.ts src/features/admin/components/admin-logs.test.tsx && node --test tests/railway-cron-poc.test.mjs && pnpm run db:types`
- [ ] Step 5: Commit: `git commit -m "feat: ship source queue admin/cron rollout"`
