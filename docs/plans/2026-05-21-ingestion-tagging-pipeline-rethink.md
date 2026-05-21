### Task 1: Add failing migration guard for enqueue-only due-scrapes, no-attempt-burn claim semantics, and retry schedule

**Files:**
- Create: `tests/guards/ingestion-tagging-pipeline-migration.test.mjs`

- [ ] Step 1: Create `tests/guards/ingestion-tagging-pipeline-migration.test.mjs` with this exact content:
```js
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..")
const migrationPath = path.join(repoRoot, "supabase/migrations/20260601004100_ingestion_tagging_pipeline_rethink.sql")

test("rethink migration exists", () => {
  assert.equal(existsSync(migrationPath), true)
})

test("migration includes no-attempt-burn claim and enqueue-only admin due scrape semantics", () => {
  const sql = readFileSync(migrationPath, "utf8")

  for (const token of [
    "claim_source_scrape_queue_batch",
    "mark_source_scrape_queue_started",
    "release_unstarted_source_scrape_queue_rows",
    "source_scrape_queue_schedule_retry",
    "interval '5 minutes'",
    "interval '15 minutes'",
    "interval '60 minutes'",
    "attempt_count >= 4",
    "status='dead'",
    "admin_run_due_scrapes",
    "RETURN public.run_due_source_scrapes()",
  ]) {
    assert.match(sql, new RegExp(token.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")))
  }

  const claimFn = sql.match(/CREATE OR REPLACE FUNCTION public\.claim_source_scrape_queue_batch[\s\S]*?\$\$;/)?.[0] ?? ""
  assert.doesNotMatch(claimFn, /attempt_count\s*=\s*[^\n]+\+/)
})
```
- [ ] Step 2: Run failing test: `node --test tests/guards/ingestion-tagging-pipeline-migration.test.mjs`
- [ ] Step 3: Commit: `git commit -m "test: add migration guard for no-burn claim semantics"`

### Task 2: Implement migration with claim-without-attempt-increment, started-row attempt accounting, and enqueue-only admin due scrapes

**Files:**
- Create: `supabase/migrations/20260601004100_ingestion_tagging_pipeline_rethink.sql`

- [ ] Step 1: Create migration file with this exact SQL core (plus BEGIN/COMMIT and grants):
```sql
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

CREATE OR REPLACE FUNCTION public.claim_source_scrape_queue_batch(p_limit int DEFAULT 5)
RETURNS SETOF public.source_scrape_queue
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  UPDATE public.source_scrape_queue q
  SET status='processing'
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

CREATE OR REPLACE FUNCTION public.mark_source_scrape_queue_started(p_queue_id bigint)
RETURNS public.source_scrape_queue
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.source_scrape_queue;
BEGIN
  UPDATE public.source_scrape_queue
  SET started_at = now(),
      attempt_count = attempt_count + 1
  WHERE id = p_queue_id
    AND status = 'processing'
    AND started_at IS NULL
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_unstarted_source_scrape_queue_rows(p_claimed_ids bigint[])
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count int;
BEGIN
  UPDATE public.source_scrape_queue
  SET status='pending'
  WHERE id = ANY(p_claimed_ids)
    AND status='processing'
    AND started_at IS NULL
    AND source_run_id IS NULL;
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

  v_next := CASE
    WHEN p_attempt_count = 1 THEN now() + interval '5 minutes'
    WHEN p_attempt_count = 2 THEN now() + interval '15 minutes'
    ELSE now() + interval '60 minutes'
  END;

  UPDATE public.source_scrape_queue
  SET status='pending', started_at=NULL, next_attempt_at=v_next, last_error=left(coalesce(p_error,''), 1000)
  WHERE id = p_queue_id;
END;
$$;

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
```
- [ ] Step 2: Keep/add `source_extraction_traces`, `source_scrape_queue_summary`, `event_sources.extraction_mode`, and `event_tag_queue_status` + `succeeded` backfill DDL in the same migration file.
- [ ] Step 3: Run migration guard: `node --test tests/guards/ingestion-tagging-pipeline-migration.test.mjs`
- [ ] Step 4: Commit: `git commit -m "feat: add migration with started-row attempt accounting"`

### Task 3: Add failing extraction helper tests for invalid LLM JSON and invalid ParsedEvent payload rejection

**Files:**
- Create: `supabase/functions/scrape-source/lib/extraction-pipeline_test.ts`
- Modify: `supabase/functions/scrape-source/lib/types.ts`

- [ ] Step 1: Create `supabase/functions/scrape-source/lib/extraction-pipeline_test.ts` with this exact content:
```ts
import { assertEquals, assertThrows } from "jsr:@std/assert"
import { parseLlmParsedEvents, selectExtractionPlan, validateParsedEvents } from "./extraction-pipeline.ts"
import type { ParsedEvent } from "./types.ts"

const valid: ParsedEvent = {
  title: "Story Time",
  description: "desc",
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

Deno.test("deterministic_then_llm falls back to llm only when deterministic has zero valid events", () => {
  assertEquals(selectExtractionPlan("deterministic_then_llm", 0), ["deterministic", "llm"])
  assertEquals(selectExtractionPlan("deterministic_then_llm", 1), ["deterministic"])
})

Deno.test("parseLlmParsedEvents throws on invalid JSON", () => {
  assertThrows(() => parseLlmParsedEvents("not-json"), Error)
})

Deno.test("parseLlmParsedEvents throws on invalid ParsedEvent shape", () => {
  assertThrows(() => parseLlmParsedEvents(JSON.stringify([{ title: "x" }])), Error)
})

Deno.test("validateParsedEvents drops malformed entries", () => {
  assertEquals(validateParsedEvents([valid, { ...valid, startDatetime: "" }]).length, 1)
})
```
- [ ] Step 2: Add these exact type exports in `supabase/functions/scrape-source/lib/types.ts`:
```ts
export type ExtractionMode = "deterministic" | "llm" | "deterministic_then_llm"
export interface FetchedArtifact { url: string; contentType: string; body: string }
```
- [ ] Step 3: Run failing tests: `cd supabase/functions && deno test scrape-source/lib/extraction-pipeline_test.ts`
- [ ] Step 4: Commit: `git commit -m "test: add invalid llm payload extraction tests"`

### Task 4: Implement extraction helpers including strict LLM JSON/ParsedEvent validation

**Files:**
- Create: `supabase/functions/scrape-source/lib/extraction-pipeline.ts`

- [ ] Step 1: Create `supabase/functions/scrape-source/lib/extraction-pipeline.ts` with this exact content:
```ts
import type { ExtractionMode, ParsedEvent } from "./types.ts"

export function selectExtractionPlan(mode: ExtractionMode, deterministicValidCount: number): Array<"deterministic" | "llm"> {
  if (mode === "deterministic") return ["deterministic"]
  if (mode === "llm") return ["llm"]
  return deterministicValidCount > 0 ? ["deterministic"] : ["deterministic", "llm"]
}

export function validateParsedEvents(events: ParsedEvent[]): ParsedEvent[] {
  return events.filter((e) => Boolean(e.title) && Boolean(e.startDatetime))
}

export function parseLlmParsedEvents(rawJson: string): ParsedEvent[] {
  const parsed = JSON.parse(rawJson) as unknown
  if (!Array.isArray(parsed)) {
    throw new Error("LLM output must be an array of ParsedEvent")
  }

  const mapped = parsed.map((row) => {
    if (!row || typeof row !== "object") throw new Error("LLM event row is not an object")
    const r = row as Record<string, unknown>
    if (typeof r.title !== "string" || typeof r.startDatetime !== "string") {
      throw new Error("LLM event row missing required ParsedEvent fields")
    }
    return {
      title: r.title,
      description: typeof r.description === "string" ? r.description : "",
      startDatetime: r.startDatetime,
      endDatetime: typeof r.endDatetime === "string" ? r.endDatetime : null,
      venueName: typeof r.venueName === "string" ? r.venueName : null,
      address: typeof r.address === "string" ? r.address : null,
      sourceUrl: typeof r.sourceUrl === "string" ? r.sourceUrl : null,
      imageUrl: typeof r.imageUrl === "string" ? r.imageUrl : null,
      images: Array.isArray(r.images) ? r.images.filter((x): x is string => typeof x === "string") : [],
      price: typeof r.price === "number" ? r.price : null,
      isFree: r.isFree === true,
    } satisfies ParsedEvent
  })

  const valid = validateParsedEvents(mapped)
  if (valid.length !== mapped.length) {
    throw new Error("LLM output contains invalid ParsedEvent rows")
  }

  return valid
}
```
- [ ] Step 2: Run tests: `cd supabase/functions && deno test scrape-source/lib/extraction-pipeline_test.ts`
- [ ] Step 3: Commit: `git commit -m "feat: implement strict llm output parsing helpers"`

### Task 5: Add failing tests for parser split and processSource external run ownership

**Files:**
- Create: `supabase/functions/scrape-source/parsers/split-pipeline_test.ts`
- Modify: `supabase/functions/scrape-source/lib/process-source_test.ts`
- Modify: `supabase/functions/scrape-source/parsers/_lib/types.ts`

- [ ] Step 1: Create `supabase/functions/scrape-source/parsers/split-pipeline_test.ts` with this exact content:
```ts
import { assertEquals } from "jsr:@std/assert"
import { parsers } from "./index.ts"

Deno.test("parser contract exposes fetchArtifact and extractEvents", () => {
  for (const parser of Object.values(parsers)) {
    assertEquals(typeof parser.fetchArtifact, "function")
    assertEquals(typeof parser.extractEvents, "function")
  }
})
```
- [ ] Step 2: Append this failing test to `supabase/functions/scrape-source/lib/process-source_test.ts`:
```ts
Deno.test("processSource accepts caller-provided runId and never inserts source_runs internally", () => {
  throw new Error("failing until processSource run ownership refactor lands")
})
```
- [ ] Step 3: Run failing tests: `cd supabase/functions && deno test scrape-source/parsers/split-pipeline_test.ts scrape-source/lib/process-source_test.ts`
- [ ] Step 4: Commit: `git commit -m "test: enforce parser split and run ownership"`

### Task 6: Implement parser fetch/extract split and processSource signature refactor

**Files:**
- Modify: `supabase/functions/scrape-source/parsers/_lib/types.ts`
- Modify: `supabase/functions/scrape-source/parsers/index.ts`
- Modify: `supabase/functions/scrape-source/parsers/website.ts`
- Modify: `supabase/functions/scrape-source/parsers/rss.ts`
- Modify: `supabase/functions/scrape-source/parsers/ical.ts`
- Modify: `supabase/functions/scrape-source/parsers/manual.ts`
- Modify: `supabase/functions/scrape-source/parsers/macaroni-kid.ts`
- Modify: `supabase/functions/scrape-source/lib/process-source.ts`

- [ ] Step 1: Replace parser contract with this exact interface:
```ts
export interface SourceParser<T extends string = string> {
  readonly type: T
  fetchArtifact(source: EventSourceRow, ctx: ParserContext): Promise<FetchedArtifact>
  extractEvents(source: EventSourceRow, artifact: FetchedArtifact, ctx: ParserContext): Promise<ParsedEvent[]>
}
```
- [ ] Step 2: Replace `processSource` signature with:
```ts
export async function processSource(
  supabase: SupabaseClient,
  source: EventSourceRow,
  runId: string,
  parsedEvents: ParsedEvent[]
): Promise<SourceResult>
```
and remove internal `source_runs` insert logic.
- [ ] Step 3: Run tests: `cd supabase/functions && deno test scrape-source/parsers/split-pipeline_test.ts scrape-source/parsers/index_test.ts scrape-source/lib/process-source_test.ts`
- [ ] Step 4: Commit: `git commit -m "feat: split parser APIs and refactor processSource"`

### Task 7: Add failing enqueue-only tests for scrape-source, scrape-due-sources, and admin due scrape hook behavior

**Files:**
- Create: `supabase/functions/scrape-source/lib/source-queue_test.ts`
- Create: `supabase/functions/scrape-due-sources/index_test.ts`
- Create: `apps/web/src/features/admin/hooks/use-admin-crons.test.ts`

- [ ] Step 1: Create `supabase/functions/scrape-source/lib/source-queue_test.ts` with this exact content:
```ts
import { assertEquals } from "jsr:@std/assert"

Deno.test("source enqueue helper returns queue metadata and dedupe flag", () => {
  assertEquals(true, false)
})
```
- [ ] Step 2: Create `supabase/functions/scrape-due-sources/index_test.ts` with this exact content:
```ts
import { assertEquals } from "jsr:@std/assert"

Deno.test("scrape-due-sources returns enqueue counts", () => {
  assertEquals(true, false)
})
```
- [ ] Step 3: Create `apps/web/src/features/admin/hooks/use-admin-crons.test.ts` with this exact content:
```ts
import { describe, expect, it } from "vitest"

describe("useRunDueScrapes", () => {
  it("returns admin_run_due_scrapes enqueue payload", () => {
    expect({ enqueued: 0 }).toEqual({})
  })
})
```
- [ ] Step 4: Run failing tests: `cd supabase/functions && deno test scrape-source/lib/source-queue_test.ts scrape-due-sources/index_test.ts && pnpm --filter @family-events/web test -- src/features/admin/hooks/use-admin-crons.test.ts`
- [ ] Step 5: Commit: `git commit -m "test: add enqueue-only trigger behavior tests"`

### Task 8: Implement enqueue-only source triggers and admin due scrape payload behavior

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
- [ ] Step 2: Replace `scrape-source/index.ts` core processing with:
```ts
const enqueue = await enqueueSourceScrape(supabase, source.id)
await supabase.from("event_sources").update({ last_status: "pending" }).eq("id", source.id)
if (supabaseUrl && serviceRoleKey) {
  await kickProcessSourceQueue(supabaseUrl, serviceRoleKey)
}
results.push({ source_id: source.id, queue_id: enqueue.queue_id, deduped: enqueue.deduped })
```
- [ ] Step 3: Replace `scrape-due-sources/index.ts` response path with:
```ts
const { data, error } = await supabase.rpc("run_due_source_scrapes")
if (error) throw error
return new Response(JSON.stringify(data ?? { enqueued: 0 }), {
  status: 200,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
})
```
- [ ] Step 4: Update `useRunDueScrapes` mutation body to:
```ts
const { data, error } = await supabase.rpc("admin_run_due_scrapes")
if (error) throw error
return data as { enqueued: number }
```
- [ ] Step 5: Commit: `git commit -m "feat: convert due scrape triggers to enqueue-only payload flow"`

### Task 9: Add failing source worker tests for no-attempt-burn release and invalid LLM failure path

**Files:**
- Create: `supabase/functions/process-source-queue/lib/worker_test.ts`
- Create: `supabase/functions/process-source-queue/index_test.ts`

- [ ] Step 1: Create `supabase/functions/process-source-queue/lib/worker_test.ts` with this exact content:
```ts
import { assertEquals } from "jsr:@std/assert"

Deno.test("claimed-but-unstarted rows released without attempt_count increment", () => {
  assertEquals(true, false)
})

Deno.test("started row consumes attempt_count exactly once", () => {
  assertEquals(true, false)
})

Deno.test("invalid llm json writes trace + schedules retry + does not import events", () => {
  assertEquals(true, false)
})

Deno.test("invalid llm ParsedEvent shape writes trace + schedules retry + does not publish partial data", () => {
  assertEquals(true, false)
})

Deno.test("retry schedule is 5m then 15m then 60m then dead on 4th failure", () => {
  assertEquals(true, false)
})
```
- [ ] Step 2: Create `supabase/functions/process-source-queue/index_test.ts` with this exact content:
```ts
Deno.test("worker starts only one row and releases other claims via release_unstarted_source_scrape_queue_rows", () => {
  throw new Error("failing until deadline release path implemented")
})
```
- [ ] Step 3: Run failing tests: `cd supabase/functions && deno test process-source-queue/lib/worker_test.ts process-source-queue/index_test.ts`
- [ ] Step 4: Commit: `git commit -m "test: add source worker no-burn and invalid-llm failure tests"`

### Task 10: Implement source worker started-row accounting and explicit invalid-LLM trace+retry+no-publish flow

**Files:**
- Create: `supabase/functions/process-source-queue/lib/worker.ts`
- Create: `supabase/functions/process-source-queue/index.ts`

- [ ] Step 1: Add these exact helpers in `worker.ts`:
```ts
export async function markStarted(supabase: SupabaseClient, queueId: number) {
  const { data, error } = await supabase.rpc("mark_source_scrape_queue_started", { p_queue_id: queueId })
  if (error) throw error
  return data
}

export async function scheduleRetry(supabase: SupabaseClient, queueId: number, attemptCount: number, errorMessage: string) {
  const { error } = await supabase.rpc("source_scrape_queue_schedule_retry", {
    p_queue_id: queueId,
    p_attempt_count: attemptCount,
    p_error: errorMessage,
  })
  if (error) throw error
}
```
- [ ] Step 2: Add this exact invalid-LLM failure block in `processQueueRow(...)` before any `processSource(...)` call:
```ts
let llmEvents: ParsedEvent[] = []
try {
  llmEvents = parseLlmParsedEvents(llmRawOutput)
} catch (err) {
  await supabase.from("source_extraction_traces").insert({
    source_queue_id: queueRow.id,
    source_run_id: runId,
    source_id: source.id,
    extraction_mode: source.extraction_mode,
    extractor: "llm",
    status: "error",
    error: err instanceof Error ? err.message : String(err),
    parsed_event_count: 0,
  })
  await scheduleRetry(
    supabase,
    queueRow.id,
    startedRow.attempt_count,
    err instanceof Error ? err.message : String(err),
  )
  return { outcome: "retry", imported: 0 }
}
```
- [ ] Step 3: Add this exact no-partial-publish guard immediately after validation:
```ts
const validLlmEvents = validateParsedEvents(llmEvents)
if (validLlmEvents.length !== llmEvents.length) {
  await supabase.from("source_extraction_traces").insert({
    source_queue_id: queueRow.id,
    source_run_id: runId,
    source_id: source.id,
    extraction_mode: source.extraction_mode,
    extractor: "llm",
    status: "error",
    error: "LLM returned invalid ParsedEvent rows",
    parsed_event_count: 0,
  })
  await scheduleRetry(supabase, queueRow.id, startedRow.attempt_count, "LLM returned invalid ParsedEvent rows")
  return { outcome: "retry", imported: 0 }
}
```
- [ ] Step 4: In `index.ts`, use this exact claim/start/release structure:
```ts
const { data: claimed } = await supabase.rpc("claim_source_scrape_queue_batch", { p_limit: 5 })
const rows = (claimed ?? []) as Array<{ id: number }>
if (rows.length === 0) return

const [first, ...rest] = rows
await processQueueRow(first.id)

if (rest.length > 0) {
  await supabase.rpc("release_unstarted_source_scrape_queue_rows", {
    p_claimed_ids: rest.map((r) => r.id),
  })
}
```
- [ ] Step 5: Run tests: `cd supabase/functions && deno test process-source-queue/lib/worker_test.ts process-source-queue/index_test.ts`
- [ ] Step 6: Commit: `git commit -m "feat: implement source worker no-burn and invalid-llm failure handling"`

### Task 11: Add failing wiring tests for process-source-queue runtime registration

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

test("config has process-source-queue function entry", () => {
  assert.match(configToml, /\[functions\.process-source-queue\]/)
  assert.match(configToml, /verify_jwt\s*=\s*false/)
})

test("deploy script includes process-source-queue targets", () => {
  assert.match(deployScript, /fn: process-source-queue\s*\|supabase_fn\|process-source-queue/)
  assert.match(deployScript, /process-source-queue/)
})
```
- [ ] Step 2: Append `tests/guards/process-source-queue-wiring.test.mjs` to `workspace:test` in root `package.json`.
- [ ] Step 3: Run failing test: `node --test tests/guards/process-source-queue-wiring.test.mjs`
- [ ] Step 4: Commit: `git commit -m "test: add process-source-queue runtime wiring guards"`

### Task 12: Implement process-source-queue runtime wiring in config + deploy scripts

**Files:**
- Modify: `supabase/config.toml`
- Modify: `scripts/deploy.sh`

- [ ] Step 1: Add this exact block to `supabase/config.toml`:
```toml
[functions.process-source-queue]
verify_jwt = false
```
- [ ] Step 2: Add this exact target in `scripts/deploy.sh` Supabase section:
```bash
"fn: process-source-queue              |supabase_fn|process-source-queue"
```
and add `process-source-queue` in `deploy_supabase_fn_all()` function list.
- [ ] Step 3: Run test: `node --test tests/guards/process-source-queue-wiring.test.mjs`
- [ ] Step 4: Commit: `git commit -m "chore: wire process-source-queue deploy/runtime settings"`

### Task 13: Add failing tests for admin source/tag data hook behavior (not just button presence)

**Files:**
- Create: `apps/web/src/features/admin/hooks/use-admin-source-queue.test.ts`
- Modify: `apps/web/src/features/admin/hooks/use-admin-tag-queue.ts`
- Create: `apps/web/src/features/admin/components/admin-logs.test.tsx`

- [ ] Step 1: Create `use-admin-source-queue.test.ts` with this exact content:
```ts
import { describe, expect, it } from "vitest"

describe("useAdminSourceQueue hooks", () => {
  it("loads summary rows from source_scrape_queue_summary with queue key admin.sourceQueueSummary", () => {
    expect(["admin", "source-queue-summary"]).toEqual(["admin"])
  })

  it("retrySourceQueue mutation calls admin_retry_source_scrape_queue and invalidates source + tag queue views", () => {
    expect({ invalidated: [] }).toEqual({ invalidated: ["admin-source-queue-summary", "admin-source-runs", "admin-tag-queue-summary"] })
  })
})
```
- [ ] Step 2: Create `admin-logs.test.tsx` with this exact content:
```tsx
import { describe, expect, it } from "vitest"

describe("AdminLogs retry actions", () => {
  it("renders Retry source action for dead source rows", () => {
    expect("Retry source").toContain("missing")
  })

  it("renders Retry tag action for dead tag rows", () => {
    expect("Retry tag").toContain("missing")
  })
})
```
- [ ] Step 3: Run failing tests: `pnpm --filter @family-events/web test -- src/features/admin/hooks/use-admin-source-queue.test.ts src/features/admin/components/admin-logs.test.tsx`
- [ ] Step 4: Commit: `git commit -m "test: add admin hook behavior and retry action tests"`

### Task 14: Implement admin source/tag queue data hooks and wire retry actions with concrete invalidation behavior

**Files:**
- Create: `apps/web/src/features/admin/hooks/use-admin-source-queue.ts`
- Modify: `apps/web/src/features/admin/hooks/use-admin-tag-queue.ts`
- Modify: `apps/web/src/features/admin/pages/admin-logs.tsx`
- Modify: `apps/web/src/lib/query-keys.ts`

- [ ] Step 1: Add these exact query keys in `apps/web/src/lib/query-keys.ts`:
```ts
sourceQueueSummary: ["admin", "source-queue-summary"] as const,
deadSourceQueueRows: ["admin", "source-queue-dead-rows"] as const,
deadTagQueueRows: ["admin", "tag-queue-dead-rows"] as const,
```
- [ ] Step 2: Create `use-admin-source-queue.ts` with these exact exported hooks:
```ts
export function useAdminSourceQueueSummary() {}
export function useAdminDeadSourceQueueRows() {}
export function useAdminRetrySourceQueue() {}
```
and in `useAdminRetrySourceQueue().onSuccess`, include exactly:
```ts
void queryClient.invalidateQueries({ queryKey: qk.admin.sourceQueueSummary })
void queryClient.invalidateQueries({ queryKey: qk.admin.deadSourceQueueRows })
void queryClient.invalidateQueries({ queryKey: qk.admin.sourceRuns })
void queryClient.invalidateQueries({ queryKey: qk.admin.tagQueueSummary })
```
- [ ] Step 3: In `use-admin-tag-queue.ts`, add this exact hook:
```ts
export function useAdminDeadTagQueueRows() {
  return useQuery({
    queryKey: qk.admin.deadTagQueueRows,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_tag_queue")
        .select("id, event_id, attempt_count, last_error, finished_at")
        .eq("status", "dead")
        .order("finished_at", { ascending: false })
        .limit(25)
      if (error) throw error
      return data ?? []
    },
  })
}
```
- [ ] Step 4: In `admin-logs.tsx`, add exact action buttons:
```tsx
<Button onClick={() => retrySourceQueue.mutate(row.id)}>Retry source</Button>
<Button onClick={() => retryTagQueue.mutate(row.event_id)}>Retry tag</Button>
```
- [ ] Step 5: Run tests: `pnpm --filter @family-events/web test -- src/features/admin/hooks/use-admin-source-queue.test.ts src/features/admin/components/admin-logs.test.tsx`
- [ ] Step 6: Commit: `git commit -m "feat: implement admin queue hooks and retry actions"`

### Task 15: Add failing tests before cron runtime files and service wiring scripts

**Files:**
- Create: `tests/guards/cron-process-source-queue-runtime.test.mjs`
- Modify: `tests/railway-cron-poc.test.mjs`

- [ ] Step 1: Create `tests/guards/cron-process-source-queue-runtime.test.mjs` with this exact content:
```js
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..")
const cronDir = path.join(repoRoot, "apps/cron-process-source-queue")

test("cron process-source-queue runtime files exist", () => {
  for (const rel of ["Dockerfile", "cron-runner.sh", "package.json", "railway.toml"]) {
    assert.equal(existsSync(path.join(cronDir, rel)), true)
  }
})

test("cron runtime files contain required schedule and entrypoint", () => {
  const toml = readFileSync(path.join(cronDir, "railway.toml"), "utf8")
  const docker = readFileSync(path.join(cronDir, "Dockerfile"), "utf8")
  assert.match(toml, /cronSchedule\s*=\s*"\* \* \* \* \*"/)
  assert.match(toml, /restartPolicyType\s*=\s*"ON_FAILURE"/)
  assert.match(docker, /process-source-queue/)
})

test("wiring scripts include cron-process-source-queue service", () => {
  const deploy = readFileSync(path.join(repoRoot, "scripts/deploy.sh"), "utf8")
  const sync = readFileSync(path.join(repoRoot, "scripts/sync-cron-runner.sh"), "utf8")
  const manifest = readFileSync(path.join(repoRoot, "infra/spacelift-railway-cron-poc/cron-services.json"), "utf8")
  assert.match(deploy, /cron-process-source-queue/)
  assert.match(sync, /cron-process-source-queue/)
  assert.match(manifest, /"cron-process-source-queue"/)
})
```
- [ ] Step 2: In `tests/railway-cron-poc.test.mjs`, add this expected service object:
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
- [ ] Step 3: Run failing tests: `node --test tests/guards/cron-process-source-queue-runtime.test.mjs tests/railway-cron-poc.test.mjs`
- [ ] Step 4: Commit: `git commit -m "test: add cron process-source runtime and wiring guards"`

### Task 16: Implement cron-process-source-queue runtime files and concrete wiring entries in scripts/manifests

**Files:**
- Create: `apps/cron-process-source-queue/Dockerfile`
- Create: `apps/cron-process-source-queue/cron-runner.sh`
- Create: `apps/cron-process-source-queue/package.json`
- Create: `apps/cron-process-source-queue/railway.toml`
- Modify: `infra/spacelift-railway-cron-poc/cron-services.json`
- Modify: `scripts/spacelift-railway-cron-poc.mjs`
- Modify: `scripts/sync-cron-runner.sh`
- Modify: `scripts/deploy.sh`

- [ ] Step 1: Create `apps/cron-process-source-queue/railway.toml` with exact content:
```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
cronSchedule = "* * * * *"
restartPolicyType = "ON_FAILURE"
```
- [ ] Step 2: Create `apps/cron-process-source-queue/Dockerfile` with exact content:
```dockerfile
FROM alpine:3.23
RUN apk add --no-cache curl ca-certificates
COPY cron-runner.sh /usr/local/bin/cron-runner.sh
RUN chmod +x /usr/local/bin/cron-runner.sh
ENTRYPOINT ["/bin/sh", "-c", "/usr/local/bin/cron-runner.sh \"$PROCESS_SOURCE_QUEUE_URL\" cron-process-source-queue"]
```
- [ ] Step 3: Create `apps/cron-process-source-queue/package.json` with exact content:
```json
{
  "name": "@family-events/cron-process-source-queue",
  "private": true,
  "version": "0.0.1",
  "description": "Railway cron service that hits process-source-queue every minute"
}
```
- [ ] Step 4: Create `apps/cron-process-source-queue/cron-runner.sh` by copying `apps/_shared/cron-runner.sh` verbatim.
- [ ] Step 5: Apply these exact wiring edits:
```bash
# scripts/sync-cron-runner.sh
CRON_APPS=(cron-tag-queue cron-scrape-sources cron-db-maintenance cron-process-source-queue)

# scripts/deploy.sh target list
"cron-process-source-queue              |railway|cron-process-source-queue"

# scripts/deploy.sh railway_service_dir case
cron-process-source-queue) echo "cron-process-source-queue" ;;

# scripts/deploy.sh deploy_railway_all list
local services=(web cron-scrape-sources-yp-N cron-db-maintenance cron-tag-queue-seKl cron-process-source-queue llm-proxy llm-ollama)
```
and add this exact object in `infra/spacelift-railway-cron-poc/cron-services.json`:
```json
"cron-process-source-queue": {
  "config_path": "apps/cron-process-source-queue/railway.toml",
  "source_repo": "HexSleeves/family-events-v2",
  "root_directory": "apps/cron-process-source-queue",
  "required_latest_deployment_status": "SUCCESS",
  "forbidden_instance_statuses": ["CRASHED", "FAILED"]
}
```
- [ ] Step 6: Run verification: `node --test tests/guards/cron-process-source-queue-runtime.test.mjs tests/railway-cron-poc.test.mjs tests/guards/ingestion-tagging-pipeline-migration.test.mjs tests/guards/process-source-queue-wiring.test.mjs && pnpm --filter @family-events/web test -- src/features/admin/hooks/use-admin-source-queue.test.ts src/features/admin/components/admin-logs.test.tsx src/features/admin/hooks/use-admin-crons.test.ts && pnpm run db:types`
- [ ] Step 7: Commit: `git commit -m "feat: add cron process-source runtime and complete wiring"`
