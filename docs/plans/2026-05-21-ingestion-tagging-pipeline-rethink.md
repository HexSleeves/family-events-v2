### Task 1: Add a failing migration guard for queue schema, skip semantics, and operator metrics columns

**Files:**
- Create: `tests/guards/ingestion-tagging-pipeline-migration.test.mjs`

- [ ] Step 1: Create `tests/guards/ingestion-tagging-pipeline-migration.test.mjs` with this exact content:
```js
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..")
const migrationPath = path.join(
  repoRoot,
  "supabase/migrations/20260601004100_ingestion_tagging_pipeline_rethink.sql"
)

test("rethink migration file exists", () => {
  assert.equal(existsSync(migrationPath), true)
})

test("rethink migration declares required queue, skip, and metrics artifacts", () => {
  const sql = readFileSync(migrationPath, "utf8")
  for (const token of [
    "source_scrape_queue_status",
    "source_scrape_queue",
    "claim_source_scrape_queue_batch",
    "reap_stuck_source_scrape_queue_rows",
    "release_unstarted_source_scrape_queue_rows",
    "source_scrape_queue_summary",
    "source_extraction_traces",
    "extraction_mode",
    "event_tag_queue_status",
    "succeeded",
    "run_due_source_scrapes",
    "oldest_pending_enqueued_at",
    "oldest_processing_started_at",
    "last_error",
    "source disabled or deleted after enqueue",
  ]) {
    assert.match(sql, new RegExp(token.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")))
  }
})
```
- [ ] Step 2: Run the failing test: `node --test tests/guards/ingestion-tagging-pipeline-migration.test.mjs`
- [ ] Step 3: Commit: `git commit -m "test: add migration guard for ingestion queue rethink"`

### Task 2: Implement source queue migration with skip-without-retry semantics and summary metrics fields

**Files:**
- Create: `supabase/migrations/20260601004100_ingestion_tagging_pipeline_rethink.sql`

- [ ] Step 1: Create `supabase/migrations/20260601004100_ingestion_tagging_pipeline_rethink.sql` and include these exact SQL blocks (plus surrounding BEGIN/COMMIT):
```sql
-- enum + queue table
CREATE TYPE public.source_scrape_queue_status AS ENUM ('pending','processing','succeeded','failed','dead');
CREATE TABLE public.source_scrape_queue (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id uuid REFERENCES public.event_sources(id) ON DELETE SET NULL,
  source_run_id uuid REFERENCES public.source_runs(id) ON DELETE SET NULL,
  status public.source_scrape_queue_status NOT NULL DEFAULT 'pending',
  attempt_count int NOT NULL DEFAULT 0,
  enqueued_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  skip_reason text
);
CREATE UNIQUE INDEX source_scrape_queue_source_active_uniq
  ON public.source_scrape_queue(source_id)
  WHERE source_id IS NOT NULL AND status IN ('pending','processing');

-- claim/reap/release RPCs
CREATE OR REPLACE FUNCTION public.claim_source_scrape_queue_batch(p_limit int DEFAULT 5)
RETURNS SETOF public.source_scrape_queue
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  UPDATE public.source_scrape_queue q
  SET status='processing', started_at=now(), attempt_count=q.attempt_count+1
  WHERE q.id IN (
    SELECT i.id
    FROM public.source_scrape_queue i
    WHERE i.status='pending' AND i.next_attempt_at <= now()
    ORDER BY i.next_attempt_at, i.id
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(1, LEAST(p_limit, 25))
  )
  RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION public.reap_stuck_source_scrape_queue_rows()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count int;
BEGIN
  UPDATE public.source_scrape_queue
  SET status='pending', started_at=NULL
  WHERE status='processing' AND started_at < now() - interval '15 minutes';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_unstarted_source_scrape_queue_rows(p_claimed_ids bigint[])
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count int;
BEGIN
  UPDATE public.source_scrape_queue
  SET status='pending', started_at=NULL
  WHERE id = ANY(p_claimed_ids) AND status='processing' AND source_run_id IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- summary with explicit operator metrics columns
CREATE OR REPLACE VIEW public.source_scrape_queue_summary
WITH (security_invoker = true) AS
SELECT
  status,
  count(*)::int AS row_count,
  min(enqueued_at) FILTER (WHERE status='pending') AS oldest_pending_enqueued_at,
  min(started_at) FILTER (WHERE status='processing') AS oldest_processing_started_at,
  max(finished_at) FILTER (WHERE status='dead') AS last_dead_letter_at,
  max(last_error) FILTER (WHERE status IN ('failed','dead')) AS last_error
FROM public.source_scrape_queue
GROUP BY status;

-- source extraction traces
CREATE TABLE public.source_extraction_traces (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_queue_id bigint NOT NULL REFERENCES public.source_scrape_queue(id) ON DELETE CASCADE,
  source_run_id uuid REFERENCES public.source_runs(id) ON DELETE SET NULL,
  source_id uuid,
  extraction_mode text NOT NULL,
  extractor text NOT NULL,
  status text NOT NULL,
  error text,
  parsed_event_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- extraction mode column + defaults/backfill
ALTER TABLE public.event_sources
  ADD COLUMN extraction_mode text NOT NULL DEFAULT 'deterministic'
  CHECK (extraction_mode IN ('deterministic','llm','deterministic_then_llm'));
UPDATE public.event_sources SET extraction_mode='deterministic' WHERE extraction_mode IS NULL;

-- tag queue status: add succeeded and preserve historical semantics
ALTER TYPE public.event_tag_queue_status ADD VALUE IF NOT EXISTS 'succeeded';
UPDATE public.event_tag_queue
SET status='succeeded', finished_at=coalesce(finished_at, now())
WHERE status='failed' AND last_error IS NULL;

-- due scrapes enqueue-only
CREATE OR REPLACE FUNCTION public.run_due_source_scrapes()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_enqueued int := 0;
BEGIN
  INSERT INTO public.source_scrape_queue (source_id)
  SELECT s.id
  FROM public.event_sources s
  WHERE s.is_active = true
    AND (s.last_scraped_at IS NULL OR s.last_scraped_at + make_interval(hours => s.scrape_interval_hours) <= now())
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_enqueued = ROW_COUNT;
  RETURN jsonb_build_object('enqueued', v_enqueued);
END;
$$;

COMMENT ON FUNCTION public.run_due_source_scrapes() IS
  'source disabled or deleted after enqueue is handled by process-source-queue skip_reason logic.';
```
- [ ] Step 2: Verify the new migration contract test passes: `node --test tests/guards/ingestion-tagging-pipeline-migration.test.mjs`
- [ ] Step 3: Commit: `git commit -m "feat: add source queue migration with skip and metrics semantics"`

### Task 3: Add failing extraction-pipeline tests for deterministic/LLM routing and trace rows

**Files:**
- Create: `supabase/functions/scrape-source/lib/extraction-pipeline_test.ts`
- Modify: `supabase/functions/scrape-source/lib/types.ts`

- [ ] Step 1: Create `supabase/functions/scrape-source/lib/extraction-pipeline_test.ts` with tests that call `selectExtractionPlan`, `validateParsedEvents`, and `buildExtractionTraceInsert`, including this explicit fallback case: deterministic returns `[]` and `deterministic_then_llm` must schedule LLM.
- [ ] Step 2: Add compile-time types in `supabase/functions/scrape-source/lib/types.ts`:
```ts
export type ExtractionMode = "deterministic" | "llm" | "deterministic_then_llm"
export interface FetchedArtifact { url: string; contentType: string; body: string }
export interface ExtractionTraceInsert {
  source_queue_id: number
  source_run_id: string | null
  source_id: string | null
  extraction_mode: ExtractionMode
  extractor: "deterministic" | "llm"
  status: "success" | "error"
  error: string | null
  parsed_event_count: number
}
```
- [ ] Step 3: Run failing tests: `cd supabase/functions && deno test scrape-source/lib/extraction-pipeline_test.ts`
- [ ] Step 4: Commit: `git commit -m "test: add extraction routing and trace tests"`

### Task 4: Implement extraction-pipeline helpers with exact deterministic->LLM fallback behavior

**Files:**
- Create: `supabase/functions/scrape-source/lib/extraction-pipeline.ts`

- [ ] Step 1: Create `supabase/functions/scrape-source/lib/extraction-pipeline.ts` with these exact exports:
```ts
import type { ExtractionMode, ExtractionTraceInsert, ParsedEvent } from "./types.ts"

export function selectExtractionPlan(mode: ExtractionMode, deterministicCount: number): Array<"deterministic" | "llm"> {
  if (mode === "deterministic") return ["deterministic"]
  if (mode === "llm") return ["llm"]
  return deterministicCount > 0 ? ["deterministic"] : ["deterministic", "llm"]
}

export function validateParsedEvents(events: ParsedEvent[]): ParsedEvent[] {
  return events.filter((e) => Boolean(e.title) && Boolean(e.startDatetime))
}

export function buildExtractionTraceInsert(input: ExtractionTraceInsert): ExtractionTraceInsert {
  return { ...input, parsed_event_count: Math.max(0, input.parsed_event_count) }
}
```
- [ ] Step 2: Run tests: `cd supabase/functions && deno test scrape-source/lib/extraction-pipeline_test.ts`
- [ ] Step 3: Commit: `git commit -m "feat: implement extraction pipeline helpers"`

### Task 5: Add failing tests for parser fetch/extract split and processSource runId ownership

**Files:**
- Create: `supabase/functions/scrape-source/parsers/split-pipeline_test.ts`
- Modify: `supabase/functions/scrape-source/lib/process-source_test.ts`
- Modify: `supabase/functions/scrape-source/parsers/_lib/types.ts`

- [ ] Step 1: Add parser contract tests that require each parser to expose `fetchArtifact` and `extractEvents` methods.
- [ ] Step 2: Add process-source tests that fail unless `processSource` accepts `runId` as an argument and never inserts into `source_runs`.
- [ ] Step 3: Run failing tests: `cd supabase/functions && deno test scrape-source/parsers/split-pipeline_test.ts scrape-source/lib/process-source_test.ts`
- [ ] Step 4: Commit: `git commit -m "test: enforce parser split and external run creation"`

### Task 6: Implement parser split and processSource signature refactor

**Files:**
- Modify: `supabase/functions/scrape-source/parsers/_lib/types.ts`
- Modify: `supabase/functions/scrape-source/parsers/index.ts`
- Modify: `supabase/functions/scrape-source/parsers/website.ts`
- Modify: `supabase/functions/scrape-source/parsers/rss.ts`
- Modify: `supabase/functions/scrape-source/parsers/ical.ts`
- Modify: `supabase/functions/scrape-source/parsers/manual.ts`
- Modify: `supabase/functions/scrape-source/parsers/macaroni-kid.ts`
- Modify: `supabase/functions/scrape-source/lib/process-source.ts`

- [ ] Step 1: Update parser interface to this exact shape:
```ts
export interface SourceParser<T extends string = string> {
  readonly type: T
  fetchArtifact(source: EventSourceRow, ctx: ParserContext): Promise<FetchedArtifact>
  extractEvents(source: EventSourceRow, artifact: FetchedArtifact, ctx: ParserContext): Promise<ParsedEvent[]>
}
```
- [ ] Step 2: Change `processSource` signature to:
```ts
export async function processSource(
  supabase: SupabaseClient,
  source: EventSourceRow,
  runId: string,
  parsedEvents: ParsedEvent[]
): Promise<SourceResult>
```
and remove the internal `source_runs` insert block.
- [ ] Step 3: Run tests: `cd supabase/functions && deno test scrape-source/parsers/split-pipeline_test.ts scrape-source/lib/process-source_test.ts scrape-source/parsers/index_test.ts`
- [ ] Step 4: Commit: `git commit -m "feat: split parser fetch/extract and refactor processSource"`

### Task 7: Add failing enqueue-only tests for scrape-source and scrape-due-sources

**Files:**
- Create: `supabase/functions/scrape-source/lib/source-queue_test.ts`
- Create: `supabase/functions/scrape-due-sources/index_test.ts`

- [ ] Step 1: Add tests asserting `scrape-source` performs queue enqueue + source pending status only, and does not call parser/import code paths.
- [ ] Step 2: Add tests asserting `scrape-due-sources` returns `{ enqueued: <n> }` from `run_due_source_scrapes`.
- [ ] Step 3: Run failing tests: `cd supabase/functions && deno test scrape-source/lib/source-queue_test.ts scrape-due-sources/index_test.ts`
- [ ] Step 4: Commit: `git commit -m "test: add enqueue-only entrypoint coverage"`

### Task 8: Implement enqueue-only entrypoints and source queue helper

**Files:**
- Create: `supabase/functions/scrape-source/lib/source-queue.ts`
- Modify: `supabase/functions/scrape-source/index.ts`
- Modify: `supabase/functions/scrape-due-sources/index.ts`

- [ ] Step 1: Create `source-queue.ts` with exact helper signatures:
```ts
export async function enqueueSourceScrape(supabase: SupabaseClient, sourceId: string): Promise<{ queue_id: number | null; deduped: boolean }>
export async function kickProcessSourceQueue(supabaseUrl: string, serviceRoleKey: string): Promise<void>
```
- [ ] Step 2: In `scrape-source/index.ts`, replace inline processing loop with:
```ts
const enqueue = await enqueueSourceScrape(supabase, source.id)
await supabase.from("event_sources").update({ last_status: "pending" }).eq("id", source.id)
await kickProcessSourceQueue(supabaseUrl, serviceRoleKey)
```
- [ ] Step 3: In `scrape-due-sources/index.ts`, return RPC payload:
```ts
const { data, error } = await supabase.rpc("run_due_source_scrapes")
return new Response(JSON.stringify(data ?? { enqueued: 0 }), { status: 200, headers: ... })
```
- [ ] Step 4: Commit: `git commit -m "feat: switch scrape entrypoints to enqueue-only"`

### Task 9: Add failing process-source-queue tests including disabled/deleted skip-without-retry behavior

**Files:**
- Create: `supabase/functions/process-source-queue/lib/worker_test.ts`
- Create: `supabase/functions/process-source-queue/index_test.ts`

- [ ] Step 1: Add a failing test named `marks disabled source as succeeded with skip_reason and no retry` asserting queue row becomes `succeeded`, `skip_reason` is set, and `next_attempt_at` is unchanged.
- [ ] Step 2: Add a failing test named `marks deleted source as succeeded with skip_reason and no dead-letter` asserting status is not `failed` or `dead`.
- [ ] Step 3: Add failing tests for release of unstarted claims and single-row start per invocation.
- [ ] Step 4: Run failing tests: `cd supabase/functions && deno test process-source-queue/lib/worker_test.ts process-source-queue/index_test.ts`
- [ ] Step 5: Commit: `git commit -m "test: cover process-source-queue skip and retry semantics"`

### Task 10: Implement process-source-queue worker logic with explicit skip reason path

**Files:**
- Create: `supabase/functions/process-source-queue/lib/worker.ts`
- Create: `supabase/functions/process-source-queue/index.ts`

- [ ] Step 1: In `worker.ts`, add exact skip handler:
```ts
export async function completeSkippedSource(
  supabase: SupabaseClient,
  queueId: number,
  reason: string
): Promise<void> {
  await supabase
    .from("source_scrape_queue")
    .update({
      status: "succeeded",
      finished_at: new Date().toISOString(),
      skip_reason: reason,
      last_error: null,
    })
    .eq("id", queueId)
}
```
- [ ] Step 2: In worker flow, when source row is missing or `is_active = false`, call `completeSkippedSource(..., "source disabled or deleted after enqueue")` and `continue` without retry/dead-letter path.
- [ ] Step 3: In `index.ts`, enforce one started row max, and call `release_unstarted_source_scrape_queue_rows` for remaining claimed IDs before deadline.
- [ ] Step 4: Run tests: `cd supabase/functions && deno test process-source-queue/lib/worker_test.ts process-source-queue/index_test.ts`
- [ ] Step 5: Commit: `git commit -m "feat: implement process-source-queue skip/no-retry semantics"`

### Task 11: Add failing wiring tests for config and deploy script coverage before editing runtime wiring

**Files:**
- Create: `tests/guards/process-source-queue-wiring.test.mjs`
- Modify: `package.json`

- [ ] Step 1: Create `tests/guards/process-source-queue-wiring.test.mjs` with assertions that `supabase/config.toml` contains `[functions.process-source-queue]` + `verify_jwt = false`, and `scripts/deploy.sh` contains `fn: process-source-queue` and deploy list item `process-source-queue`.
- [ ] Step 2: Add the new guard to `package.json` `workspace:test` script by appending `tests/guards/process-source-queue-wiring.test.mjs`.
- [ ] Step 3: Run failing test: `node --test tests/guards/process-source-queue-wiring.test.mjs`
- [ ] Step 4: Commit: `git commit -m "test: add process-source-queue wiring guards"`

### Task 12: Implement config/deploy wiring required by the new source worker

**Files:**
- Modify: `supabase/config.toml`
- Modify: `scripts/deploy.sh`

- [ ] Step 1: Add this exact block in `supabase/config.toml`:
```toml
[functions.process-source-queue]
verify_jwt = false
```
- [ ] Step 2: In `scripts/deploy.sh`, add this exact function entry under Supabase targets:
```bash
"fn: process-source-queue              |supabase_fn|process-source-queue"
```
and add `process-source-queue` to `deploy_supabase_fn_all()` list.
- [ ] Step 3: Run tests: `node --test tests/guards/process-source-queue-wiring.test.mjs`
- [ ] Step 4: Commit: `git commit -m "chore: wire process-source-queue in config and deploy script"`

### Task 13: Add failing process-tag-queue tests for `succeeded` status and deadline release behavior

**Files:**
- Create: `supabase/functions/process-tag-queue/index_test.ts`

- [ ] Step 1: Add failing tests that assert successful rows transition to `succeeded` and never to `failed`.
- [ ] Step 2: Add failing tests that assert claimed rows with no start marker are released to `pending` near deadline while started rows retain retry/dead logic.
- [ ] Step 3: Run failing tests: `cd supabase/functions && deno test process-tag-queue/index_test.ts`
- [ ] Step 4: Commit: `git commit -m "test: add process-tag-queue succeeded/deadline tests"`

### Task 14: Implement process-tag-queue `succeeded` semantics and unstarted-release path

**Files:**
- Modify: `supabase/functions/process-tag-queue/index.ts`

- [ ] Step 1: Replace success row update to this exact payload:
```ts
.update({
  status: "succeeded",
  finished_at: new Date().toISOString(),
  last_error: null,
})
```
- [ ] Step 2: Before timeout exit, call new RPC to release unstarted rows (same behavior pattern as source queue), leaving started rows on existing retry schedule.
- [ ] Step 3: Run tests: `cd supabase/functions && deno test process-tag-queue/index_test.ts`
- [ ] Step 4: Commit: `git commit -m "feat: apply succeeded status and unstarted release in tag worker"`

### Task 15: Add failing admin tests for metrics/source_runs visibility, extraction-mode defaults, and new cron service manifest

**Files:**
- Create: `apps/web/src/features/admin/components/admin-logs.test.tsx`
- Create: `apps/web/src/features/admin/hooks/use-admin-sources.test.ts`
- Modify: `apps/web/src/lib/schemas/admin.test.ts`
- Modify: `tests/railway-cron-poc.test.mjs`

- [ ] Step 1: Add admin logs render tests that fail unless UI shows: `Oldest pending age`, `Active processing age`, `Last error`, and `Recent source runs` list.
- [ ] Step 2: Add `use-admin-sources.test.ts` failing tests for helper `defaultExtractionModeForSourceType` with exact expected mapping: `website -> deterministic_then_llm`, `macaronikid -> deterministic_then_llm`, `rss|ical|manual -> deterministic`.
- [ ] Step 3: Extend `apps/web/src/lib/schemas/admin.test.ts` to require `extraction_mode` enum acceptance and `event_tag_queue_status` to include `succeeded`.
- [ ] Step 4: Update `tests/railway-cron-poc.test.mjs` expected services to include `cron-process-source-queue` with `* * * * *` and `apps/cron-process-source-queue`.
- [ ] Step 5: Run failing tests: `pnpm --filter @family-events/web test -- src/features/admin/components/admin-logs.test.tsx src/features/admin/hooks/use-admin-sources.test.ts src/lib/schemas/admin.test.ts && node --test tests/railway-cron-poc.test.mjs`
- [ ] Step 6: Commit: `git commit -m "test: add admin metrics/defaults/cron-process-source-queue coverage"`

### Task 16: Implement admin metrics + source-runs visibility, extraction-mode defaults, and cron-process-source-queue app wiring

**Files:**
- Create: `apps/web/src/features/admin/hooks/use-admin-source-queue.ts`
- Create: `apps/cron-process-source-queue/Dockerfile`
- Create: `apps/cron-process-source-queue/cron-runner.sh`
- Create: `apps/cron-process-source-queue/package.json`
- Create: `apps/cron-process-source-queue/railway.toml`
- Modify: `apps/web/src/features/admin/pages/admin-logs.tsx`
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

- [ ] Step 1: Add helper in `use-admin-sources.ts` with exact mapping:
```ts
export function defaultExtractionModeForSourceType(sourceType: EventSource["source_type"]): "deterministic" | "deterministic_then_llm" {
  if (sourceType === "website" || sourceType === "macaronikid") return "deterministic_then_llm"
  return "deterministic"
}
```
and use it in create-source payload.
- [ ] Step 2: Implement `use-admin-source-queue.ts` to query `source_scrape_queue_summary` and `source_scrape_queue` dead rows, and render in `admin-logs.tsx` sections for metrics (`Oldest pending age`, `Active processing age`, `Last error`) and recent `source_runs`.
- [ ] Step 3: Create `apps/cron-process-source-queue/*` by copying existing cron app pattern with these exact values in `railway.toml`:
```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
cronSchedule = "* * * * *"
restartPolicyType = "ON_FAILURE"
```
- [ ] Step 4: Update manifests/scripts (`infra/spacelift-railway-cron-poc/cron-services.json`, `scripts/spacelift-railway-cron-poc.mjs`, `scripts/sync-cron-runner.sh`, `scripts/deploy.sh`) to include `cron-process-source-queue`.
- [ ] Step 5: Run verification: `pnpm --filter @family-events/web test -- src/features/admin/components/admin-logs.test.tsx src/features/admin/hooks/use-admin-sources.test.ts src/lib/schemas/admin.test.ts && node --test tests/railway-cron-poc.test.mjs && node --test tests/guards/process-source-queue-wiring.test.mjs && pnpm run db:types`
- [ ] Step 6: Commit: `git commit -m "feat: ship admin metrics/defaults and process-source-queue cron wiring"`
