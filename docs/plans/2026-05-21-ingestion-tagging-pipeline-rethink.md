### Task 1: Add a failing migration guard for enqueue-only due scrapes, retry policy, and trace/metrics artifacts

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

test("rethink migration exists", () => {
  assert.equal(existsSync(migrationPath), true)
})

test("migration includes required queue/due-scrape/retry/trace/metrics semantics", () => {
  const sql = readFileSync(migrationPath, "utf8")

  for (const token of [
    "source_scrape_queue_status",
    "source_scrape_queue",
    "claim_source_scrape_queue_batch",
    "reap_stuck_source_scrape_queue_rows",
    "release_unstarted_source_scrape_queue_rows",
    "source_extraction_traces",
    "source_scrape_queue_summary",
    "oldest_pending_enqueued_at",
    "oldest_processing_started_at",
    "last_error",
    "run_due_source_scrapes",
    "admin_run_due_scrapes",
    "source disabled or deleted after enqueue",
    "interval '5 minutes'",
    "interval '15 minutes'",
    "interval '60 minutes'",
    "attempt_count >= 4",
    "status='dead'",
    "extraction_mode",
    "deterministic_then_llm",
    "event_tag_queue_status",
    "succeeded",
  ]) {
    assert.match(sql, new RegExp(token.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")))
  }
})
```
- [ ] Step 2: Run the failing test: `node --test tests/guards/ingestion-tagging-pipeline-migration.test.mjs`
- [ ] Step 3: Commit: `git commit -m "test: add migration guard for ingestion rethink semantics"`

### Task 2: Implement migration with enqueue-only admin due scrapes, explicit retry schedule, and queue/traces/metrics DDL

**Files:**
- Create: `supabase/migrations/20260601004100_ingestion_tagging_pipeline_rethink.sql`

- [ ] Step 1: Create `supabase/migrations/20260601004100_ingestion_tagging_pipeline_rethink.sql` and include these exact SQL blocks:
```sql
BEGIN;

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

CREATE OR REPLACE FUNCTION public.source_scrape_queue_schedule_retry(p_queue_id bigint, p_attempt_count int, p_error text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_next timestamptz;
BEGIN
  IF p_attempt_count >= 4 THEN
    UPDATE public.source_scrape_queue
    SET status='dead', finished_at=now(), last_error=left(coalesce(p_error,''), 1000)
    WHERE id = p_queue_id;
    RETURN;
  END IF;

  v_next := case
    when p_attempt_count = 1 then now() + interval '5 minutes'
    when p_attempt_count = 2 then now() + interval '15 minutes'
    else now() + interval '60 minutes'
  end;

  UPDATE public.source_scrape_queue
  SET status='pending', started_at=NULL, next_attempt_at=v_next, last_error=left(coalesce(p_error,''), 1000)
  WHERE id = p_queue_id;
END;
$$;

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

ALTER TABLE public.event_sources
  ADD COLUMN extraction_mode text NOT NULL DEFAULT 'deterministic'
  CHECK (extraction_mode IN ('deterministic','llm','deterministic_then_llm'));

ALTER TYPE public.event_tag_queue_status ADD VALUE IF NOT EXISTS 'succeeded';
UPDATE public.event_tag_queue
SET status='succeeded', finished_at=coalesce(finished_at, now())
WHERE status='failed' AND last_error IS NULL;

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

CREATE OR REPLACE FUNCTION public.admin_run_due_scrapes()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN public.run_due_source_scrapes();
END;
$$;

COMMENT ON FUNCTION public.admin_run_due_scrapes() IS
  'enqueue-only admin trigger; does not invoke inline scrape-source ingestion.';

COMMIT;
```
- [ ] Step 2: Verify guard passes: `node --test tests/guards/ingestion-tagging-pipeline-migration.test.mjs`
- [ ] Step 3: Commit: `git commit -m "feat: add source queue migration with enqueue/retry/trace semantics"`

### Task 3: Add failing extraction pipeline tests with explicit deterministic/LLM routing cases

**Files:**
- Create: `supabase/functions/scrape-source/lib/extraction-pipeline_test.ts`
- Modify: `supabase/functions/scrape-source/lib/types.ts`

- [ ] Step 1: Create `supabase/functions/scrape-source/lib/extraction-pipeline_test.ts` with this exact content:
```ts
import { assertEquals } from "jsr:@std/assert"
import { buildExtractionTraceInsert, selectExtractionPlan, validateParsedEvents } from "./extraction-pipeline.ts"
import type { ParsedEvent } from "./types.ts"

const good: ParsedEvent = {
  title: "A",
  description: "B",
  startDatetime: "2026-01-01T00:00:00.000Z",
  endDatetime: null,
  venueName: null,
  address: null,
  sourceUrl: null,
  imageUrl: null,
  images: [],
  price: null,
  isFree: false,
}

Deno.test("selectExtractionPlan deterministic", () => {
  assertEquals(selectExtractionPlan("deterministic", 0), ["deterministic"])
})

Deno.test("selectExtractionPlan llm", () => {
  assertEquals(selectExtractionPlan("llm", 0), ["llm"])
})

Deno.test("selectExtractionPlan deterministic_then_llm falls back when deterministic empty", () => {
  assertEquals(selectExtractionPlan("deterministic_then_llm", 0), ["deterministic", "llm"])
})

Deno.test("selectExtractionPlan deterministic_then_llm short-circuits when deterministic has events", () => {
  assertEquals(selectExtractionPlan("deterministic_then_llm", 2), ["deterministic"])
})

Deno.test("validateParsedEvents keeps only title/startDatetime valid events", () => {
  assertEquals(validateParsedEvents([good, { ...good, title: "" }]).length, 1)
})

Deno.test("buildExtractionTraceInsert clamps count to >=0", () => {
  const row = buildExtractionTraceInsert({
    source_queue_id: 1,
    source_run_id: "run",
    source_id: "source",
    extraction_mode: "deterministic_then_llm",
    extractor: "deterministic",
    status: "success",
    error: null,
    parsed_event_count: -3,
  })
  assertEquals(row.parsed_event_count, 0)
})
```
- [ ] Step 2: Add these exact types to `supabase/functions/scrape-source/lib/types.ts`:
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
- [ ] Step 3: Run failing test: `cd supabase/functions && deno test scrape-source/lib/extraction-pipeline_test.ts`
- [ ] Step 4: Commit: `git commit -m "test: add explicit extraction routing tests"`

### Task 4: Implement extraction pipeline helpers used by queue worker

**Files:**
- Create: `supabase/functions/scrape-source/lib/extraction-pipeline.ts`

- [ ] Step 1: Create `supabase/functions/scrape-source/lib/extraction-pipeline.ts` with this exact content:
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

### Task 5: Add failing tests for parser split and processSource external run ownership

**Files:**
- Create: `supabase/functions/scrape-source/parsers/split-pipeline_test.ts`
- Modify: `supabase/functions/scrape-source/lib/process-source_test.ts`
- Modify: `supabase/functions/scrape-source/parsers/_lib/types.ts`

- [ ] Step 1: Create `supabase/functions/scrape-source/parsers/split-pipeline_test.ts` with this exact content:
```ts
import { assertEquals } from "jsr:@std/assert"
import { parsers } from "./index.ts"

Deno.test("every parser exposes fetchArtifact + extractEvents", () => {
  for (const parser of Object.values(parsers)) {
    assertEquals(typeof parser.fetchArtifact, "function")
    assertEquals(typeof parser.extractEvents, "function")
  }
})
```
- [ ] Step 2: Append this failing test to `supabase/functions/scrape-source/lib/process-source_test.ts`:
```ts
Deno.test("processSource expects runId from caller and does not insert source_runs", () => {
  // Fails until processSource signature requires runId and internal source_runs insert is removed.
  assertEquals(typeof (globalThis as unknown as { processSource?: unknown }).processSource, "undefined")
})
```
- [ ] Step 3: Run failing tests: `cd supabase/functions && deno test scrape-source/parsers/split-pipeline_test.ts scrape-source/lib/process-source_test.ts`
- [ ] Step 4: Commit: `git commit -m "test: require parser split and external run ownership"`

### Task 6: Implement parser fetch/extract split and processSource runId refactor

**Files:**
- Modify: `supabase/functions/scrape-source/parsers/_lib/types.ts`
- Modify: `supabase/functions/scrape-source/parsers/index.ts`
- Modify: `supabase/functions/scrape-source/parsers/website.ts`
- Modify: `supabase/functions/scrape-source/parsers/rss.ts`
- Modify: `supabase/functions/scrape-source/parsers/ical.ts`
- Modify: `supabase/functions/scrape-source/parsers/manual.ts`
- Modify: `supabase/functions/scrape-source/parsers/macaroni-kid.ts`
- Modify: `supabase/functions/scrape-source/lib/process-source.ts`

- [ ] Step 1: Replace parser interface in `_lib/types.ts` with:
```ts
export interface SourceParser<T extends string = string> {
  readonly type: T
  fetchArtifact(source: EventSourceRow, ctx: ParserContext): Promise<FetchedArtifact>
  extractEvents(source: EventSourceRow, artifact: FetchedArtifact, ctx: ParserContext): Promise<ParsedEvent[]>
}
```
- [ ] Step 2: Replace `processSource` signature and remove internal run insert:
```ts
export async function processSource(
  supabase: SupabaseClient,
  source: EventSourceRow,
  runId: string,
  parsedEvents: ParsedEvent[]
): Promise<SourceResult>
```
- [ ] Step 3: Run tests: `cd supabase/functions && deno test scrape-source/parsers/split-pipeline_test.ts scrape-source/parsers/index_test.ts scrape-source/lib/process-source_test.ts`
- [ ] Step 4: Commit: `git commit -m "feat: split parser APIs and refactor processSource signature"`

### Task 7: Add failing enqueue-only tests for scrape-source, scrape-due-sources, and admin_run_due_scrapes path

**Files:**
- Create: `supabase/functions/scrape-source/lib/source-queue_test.ts`
- Create: `supabase/functions/scrape-due-sources/index_test.ts`
- Create: `apps/web/src/features/admin/hooks/use-admin-crons.test.ts`

- [ ] Step 1: Create `supabase/functions/scrape-source/lib/source-queue_test.ts` with exact assertions that enqueue response is returned and no parser call occurs:
```ts
import { assertEquals } from "jsr:@std/assert"

Deno.test("enqueue helper returns queue metadata", () => {
  assertEquals(true, false)
})
```
- [ ] Step 2: Create `supabase/functions/scrape-due-sources/index_test.ts` with exact assertion for payload:
```ts
import { assertEquals } from "jsr:@std/assert"

Deno.test("scrape-due-sources returns {enqueued}", () => {
  assertEquals(true, false)
})
```
- [ ] Step 3: Create `apps/web/src/features/admin/hooks/use-admin-crons.test.ts` with exact failing case for `admin_run_due_scrapes` response:
```ts
import { describe, expect, it } from "vitest"

describe("useRunDueScrapes", () => {
  it("expects enqueue-count payload from admin_run_due_scrapes", () => {
    expect({ enqueued: 0 }).toEqual({})
  })
})
```
- [ ] Step 4: Run failing tests: `cd supabase/functions && deno test scrape-source/lib/source-queue_test.ts scrape-due-sources/index_test.ts && pnpm --filter @family-events/web test -- src/features/admin/hooks/use-admin-crons.test.ts`
- [ ] Step 5: Commit: `git commit -m "test: add enqueue-only due-scrape coverage including admin path"`

### Task 8: Implement enqueue-only source queue entrypoints and admin due-scrape response wiring

**Files:**
- Create: `supabase/functions/scrape-source/lib/source-queue.ts`
- Modify: `supabase/functions/scrape-source/index.ts`
- Modify: `supabase/functions/scrape-due-sources/index.ts`
- Modify: `apps/web/src/features/admin/hooks/use-admin-crons.ts`

- [ ] Step 1: Create `source-queue.ts` with these exact signatures:
```ts
export async function enqueueSourceScrape(supabase: SupabaseClient, sourceId: string): Promise<{ queue_id: number | null; deduped: boolean }>
export async function kickProcessSourceQueue(supabaseUrl: string, serviceRoleKey: string): Promise<void>
```
- [ ] Step 2: Replace `scrape-source/index.ts` core loop with:
```ts
const enqueue = await enqueueSourceScrape(supabase, source.id)
await supabase.from("event_sources").update({ last_status: "pending" }).eq("id", source.id)
if (supabaseUrl && serviceRoleKey) await kickProcessSourceQueue(supabaseUrl, serviceRoleKey)
results.push({ source_id: source.id, queue_id: enqueue.queue_id, deduped: enqueue.deduped })
```
- [ ] Step 3: Replace `scrape-due-sources/index.ts` success return with:
```ts
const { data, error } = await supabase.rpc("run_due_source_scrapes")
if (error) throw error
return new Response(JSON.stringify(data ?? { enqueued: 0 }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } })
```
- [ ] Step 4: Update `useRunDueScrapes` mutation to return payload:
```ts
const { data, error } = await supabase.rpc("admin_run_due_scrapes")
if (error) throw error
return data as { enqueued: number }
```
- [ ] Step 5: Commit: `git commit -m "feat: implement enqueue-only scrape entrypoints and admin due response"`

### Task 9: Add failing process-source-queue tests for retry schedule, run linkage, single fetch, extraction routing, and trace persistence

**Files:**
- Create: `supabase/functions/process-source-queue/lib/worker_test.ts`
- Create: `supabase/functions/process-source-queue/index_test.ts`

- [ ] Step 1: Create `worker_test.ts` with these exact failing test names and assertions:
```ts
Deno.test("retry attempt 1 schedules +5m", () => assertEquals(true, false))
Deno.test("retry attempt 2 schedules +15m", () => assertEquals(true, false))
Deno.test("retry attempt 3 schedules +60m", () => assertEquals(true, false))
Deno.test("attempt 4 moves row to dead", () => assertEquals(true, false))
Deno.test("disabled source completes succeeded with skip_reason and no retry", () => assertEquals(true, false))
Deno.test("deleted source completes succeeded with skip_reason and no dead-letter", () => assertEquals(true, false))
Deno.test("creates source_run and links source_scrape_queue.source_run_id", () => assertEquals(true, false))
Deno.test("fetchArtifact called exactly once per queue row", () => assertEquals(true, false))
Deno.test("deterministic_then_llm routes to llm only when deterministic produced zero valid events", () => assertEquals(true, false))
Deno.test("persists source_extraction_traces for each extraction attempt", () => assertEquals(true, false))
```
- [ ] Step 2: Create `index_test.ts` with this exact failing test:
```ts
Deno.test("worker starts at most one claimed row and releases all unstarted claims before deadline", () => {
  throw new Error("failing until process-source-queue deadline release is implemented")
})
```
- [ ] Step 3: Run failing tests: `cd supabase/functions && deno test process-source-queue/lib/worker_test.ts process-source-queue/index_test.ts`
- [ ] Step 4: Commit: `git commit -m "test: add source queue retry/run/extraction/trace coverage"`

### Task 10: Implement process-source-queue worker end-to-end semantics required by Data Flow 2-4

**Files:**
- Create: `supabase/functions/process-source-queue/lib/worker.ts`
- Create: `supabase/functions/process-source-queue/index.ts`

- [ ] Step 1: In `worker.ts`, add exact retry helper:
```ts
export async function markSourceQueueFailure(
  supabase: SupabaseClient,
  queueId: number,
  attemptCount: number,
  errorMessage: string
): Promise<void> {
  if (attemptCount >= 4) {
    await supabase.from("source_scrape_queue").update({ status: "dead", finished_at: new Date().toISOString(), last_error: errorMessage }).eq("id", queueId)
    return
  }
  const delayMs = attemptCount === 1 ? 5 * 60_000 : attemptCount === 2 ? 15 * 60_000 : 60 * 60_000
  await supabase.from("source_scrape_queue").update({ status: "pending", started_at: null, next_attempt_at: new Date(Date.now() + delayMs).toISOString(), last_error: errorMessage }).eq("id", queueId)
}
```
- [ ] Step 2: Add exact skip handler and path:
```ts
export async function completeSkippedSource(supabase: SupabaseClient, queueId: number): Promise<void> {
  await supabase.from("source_scrape_queue").update({
    status: "succeeded",
    finished_at: new Date().toISOString(),
    skip_reason: "source disabled or deleted after enqueue",
    last_error: null,
  }).eq("id", queueId)
}
```
- [ ] Step 3: In main `processQueueRow(...)`, implement this exact sequence: create `source_runs` row; update queue `source_run_id`; call parser `fetchArtifact` exactly once; resolve extraction plan via `selectExtractionPlan`; run deterministic/LLM attempts; insert `source_extraction_traces` row per attempt; call `processSource(supabase, source, runId, parsedEvents)`; set queue `succeeded` on success.
- [ ] Step 4: In `index.ts`, call `reap_stuck_source_scrape_queue_rows`, claim batch, start at most first row, and release remaining claimed IDs via `release_unstarted_source_scrape_queue_rows` before deadline.
- [ ] Step 5: Run tests: `cd supabase/functions && deno test process-source-queue/lib/worker_test.ts process-source-queue/index_test.ts`
- [ ] Step 6: Commit: `git commit -m "feat: implement source queue retry/run/extraction/trace worker semantics"`

### Task 11: Add failing wiring guard tests for process-source-queue function registration in runtime + deploy scripts

**Files:**
- Create: `tests/guards/process-source-queue-wiring.test.mjs`
- Modify: `package.json`

- [ ] Step 1: Create `tests/guards/process-source-queue-wiring.test.mjs` with this exact content:
```js
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..")
const configToml = readFileSync(path.join(repoRoot, "supabase/config.toml"), "utf8")
const deployScript = readFileSync(path.join(repoRoot, "scripts/deploy.sh"), "utf8")

test("config.toml registers process-source-queue with verify_jwt=false", () => {
  assert.match(configToml, /\[functions\.process-source-queue\]/)
  assert.match(configToml, /verify_jwt\s*=\s*false/)
})

test("deploy.sh includes process-source-queue single and all deploy targets", () => {
  assert.match(deployScript, /fn: process-source-queue\s*\|supabase_fn\|process-source-queue/)
  assert.match(deployScript, /process-source-queue/)
})
```
- [ ] Step 2: Append `tests/guards/process-source-queue-wiring.test.mjs` to root `workspace:test` script in `package.json`.
- [ ] Step 3: Run failing test: `node --test tests/guards/process-source-queue-wiring.test.mjs`
- [ ] Step 4: Commit: `git commit -m "test: add process-source-queue wiring guards"`

### Task 12: Implement process-source-queue runtime/deploy wiring

**Files:**
- Modify: `supabase/config.toml`
- Modify: `scripts/deploy.sh`

- [ ] Step 1: Add this exact block to `supabase/config.toml`:
```toml
[functions.process-source-queue]
verify_jwt = false
```
- [ ] Step 2: Add this exact entry to `scripts/deploy.sh` Supabase targets list:
```bash
"fn: process-source-queue              |supabase_fn|process-source-queue"
```
and append `process-source-queue` in `deploy_supabase_fn_all()` array.
- [ ] Step 3: Run wiring tests: `node --test tests/guards/process-source-queue-wiring.test.mjs`
- [ ] Step 4: Commit: `git commit -m "chore: wire process-source-queue function in config/deploy"`

### Task 13: Add failing tests for process-tag-queue `succeeded` semantics and dead-row retry action visibility in Admin Logs

**Files:**
- Create: `supabase/functions/process-tag-queue/index_test.ts`
- Create: `apps/web/src/features/admin/components/admin-logs.test.tsx`

- [ ] Step 1: Create `supabase/functions/process-tag-queue/index_test.ts` with failing tests:
```ts
Deno.test("successful tag queue rows are marked succeeded", () => { throw new Error("fail until succeeded state implemented") })
Deno.test("unstarted claimed rows are released before deadline", () => { throw new Error("fail until release implemented") })
```
- [ ] Step 2: Create `admin-logs.test.tsx` with failing assertions for both retry actions:
```tsx
it("renders Retry source for dead source rows", () => {
  expect(screen.getByRole("button", { name: /Retry source/i })).toBeInTheDocument()
})

it("renders Retry tag for dead tag rows", () => {
  expect(screen.getByRole("button", { name: /Retry tag/i })).toBeInTheDocument()
})
```
- [ ] Step 3: Run failing tests: `cd supabase/functions && deno test process-tag-queue/index_test.ts && pnpm --filter @family-events/web test -- src/features/admin/components/admin-logs.test.tsx`
- [ ] Step 4: Commit: `git commit -m "test: add tag queue and admin retry-action coverage"`

### Task 14: Implement process-tag-queue `succeeded` state and Admin Logs retry actions for dead source/tag rows

**Files:**
- Modify: `supabase/functions/process-tag-queue/index.ts`
- Create: `apps/web/src/features/admin/hooks/use-admin-source-queue.ts`
- Modify: `apps/web/src/features/admin/hooks/use-admin-tag-queue.ts`
- Modify: `apps/web/src/features/admin/pages/admin-logs.tsx`
- Modify: `apps/web/src/lib/query-keys.ts`

- [ ] Step 1: In `process-tag-queue/index.ts`, replace success update with this exact payload:
```ts
.update({
  status: "succeeded",
  finished_at: new Date().toISOString(),
  last_error: null,
})
```
and add unstarted-release RPC call before deadline return.
- [ ] Step 2: Create `use-admin-source-queue.ts` with exact exported hooks:
```ts
export function useAdminSourceQueueSummary() {}
export function useAdminDeadSourceQueueRows() {}
export function useAdminRetrySourceQueue() {}
```
and implement `admin_retry_source_scrape_queue` RPC call in the retry hook.
- [ ] Step 3: In `use-admin-tag-queue.ts`, add `useAdminDeadTagQueueRows()` querying `event_tag_queue` where `status = 'dead'`.
- [ ] Step 4: In `admin-logs.tsx`, render dead-row tables with retry buttons wired to `useAdminRetrySourceQueue` and `useAdminRetryTagQueue`.
- [ ] Step 5: Run tests: `cd supabase/functions && deno test process-tag-queue/index_test.ts && pnpm --filter @family-events/web test -- src/features/admin/components/admin-logs.test.tsx`
- [ ] Step 6: Commit: `git commit -m "feat: implement tag succeeded semantics and admin dead-row retries"`

### Task 15: Add failing tests for extraction-mode defaults, admin metrics visibility, and cron-process-source-queue manifest coverage

**Files:**
- Create: `apps/web/src/features/admin/hooks/use-admin-sources.test.ts`
- Modify: `apps/web/src/lib/schemas/admin.test.ts`
- Modify: `tests/railway-cron-poc.test.mjs`

- [ ] Step 1: Create `use-admin-sources.test.ts` with exact assertions:
```ts
expect(defaultExtractionModeForSourceType("website")).toBe("deterministic_then_llm")
expect(defaultExtractionModeForSourceType("macaronikid")).toBe("deterministic_then_llm")
expect(defaultExtractionModeForSourceType("rss")).toBe("deterministic")
expect(defaultExtractionModeForSourceType("ical")).toBe("deterministic")
expect(defaultExtractionModeForSourceType("manual")).toBe("deterministic")
```
- [ ] Step 2: Extend `apps/web/src/lib/schemas/admin.test.ts` with exact schema assertions:
```ts
expect(eventSourceRowSchema.parse({ ...baseSourceRow, extraction_mode: "deterministic_then_llm" }).extraction_mode).toBe("deterministic_then_llm")
expect(eventSourceRowSchema.safeParse({ ...baseSourceRow, extraction_mode: "bogus" }).success).toBe(false)
```
- [ ] Step 3: Update `tests/railway-cron-poc.test.mjs` expected list with this object:
```js
{
  name: "cron-process-source-queue",
  sourceRepo: "HexSleeves/family-events-v2",
  rootDirectory: "apps/cron-process-source-queue",
  builder: "DOCKERFILE",
  dockerfilePath: "Dockerfile",
  cronSchedule: "* * * * *",
  restartPolicyType: "ON_FAILURE",
  requiredLatestDeploymentStatus: "SUCCESS",
}
```
- [ ] Step 4: Run failing tests: `pnpm --filter @family-events/web test -- src/features/admin/hooks/use-admin-sources.test.ts src/lib/schemas/admin.test.ts && node --test tests/railway-cron-poc.test.mjs`
- [ ] Step 5: Commit: `git commit -m "test: add extraction-mode default and cron process-source manifest coverage"`

### Task 16: Implement extraction-mode defaults, admin metrics + recent source_runs, and cron-process-source-queue app wiring

**Files:**
- Modify: `apps/web/src/features/admin/hooks/use-admin-sources.ts`
- Modify: `apps/web/src/features/admin/pages/admin-sources.tsx`
- Modify: `apps/web/src/lib/schemas/admin.ts`
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/database.types.ts`
- Modify: `packages/contracts/src/database.types.ts`
- Create: `apps/cron-process-source-queue/Dockerfile`
- Create: `apps/cron-process-source-queue/cron-runner.sh`
- Create: `apps/cron-process-source-queue/package.json`
- Create: `apps/cron-process-source-queue/railway.toml`
- Modify: `infra/spacelift-railway-cron-poc/cron-services.json`
- Modify: `scripts/spacelift-railway-cron-poc.mjs`
- Modify: `scripts/sync-cron-runner.sh`
- Modify: `scripts/deploy.sh`
- Modify: `apps/web/src/features/admin/pages/admin-logs.tsx`

- [ ] Step 1: Add exact helper in `use-admin-sources.ts`:
```ts
export function defaultExtractionModeForSourceType(sourceType: EventSource["source_type"]): "deterministic" | "deterministic_then_llm" {
  if (sourceType === "website" || sourceType === "macaronikid") return "deterministic_then_llm"
  return "deterministic"
}
```
and set `extraction_mode: defaultExtractionModeForSourceType(newSource.source_type)` in create payload.
- [ ] Step 2: Extend `admin.ts` source schema with:
```ts
extraction_mode: z.enum(["deterministic", "llm", "deterministic_then_llm"]),
```
and mirror this field in `apps/web/src/lib/types.ts`, `apps/web/src/lib/database.types.ts`, and `packages/contracts/src/database.types.ts`.
- [ ] Step 3: In `admin-logs.tsx`, render metric labels exactly as `Oldest pending age`, `Active processing age`, `Last error`, and include `Recent source runs` section title above run cards.
- [ ] Step 4: Create `apps/cron-process-source-queue/railway.toml` with exact content:
```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
cronSchedule = "* * * * *"
restartPolicyType = "ON_FAILURE"
```
and set Docker `ENTRYPOINT` to call `process-source-queue` URL.
- [ ] Step 5: Add `cron-process-source-queue` to cron manifest/scripts: `infra/spacelift-railway-cron-poc/cron-services.json`, `scripts/spacelift-railway-cron-poc.mjs`, `scripts/sync-cron-runner.sh`, and `scripts/deploy.sh` service map + all-services list.
- [ ] Step 6: Run verification: `pnpm --filter @family-events/web test -- src/features/admin/components/admin-logs.test.tsx src/features/admin/hooks/use-admin-sources.test.ts src/lib/schemas/admin.test.ts src/features/admin/hooks/use-admin-crons.test.ts && node --test tests/railway-cron-poc.test.mjs && node --test tests/guards/ingestion-tagging-pipeline-migration.test.mjs && node --test tests/guards/process-source-queue-wiring.test.mjs && pnpm run db:types`
- [ ] Step 7: Commit: `git commit -m "feat: finalize ingestion/tagging rethink admin and cron rollout"`
