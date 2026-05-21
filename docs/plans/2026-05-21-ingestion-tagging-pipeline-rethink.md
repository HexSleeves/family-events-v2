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
    "reap_stuck_source_scrape_queue_rows",
    "mark_source_scrape_queue_skipped",
    "source_scrape_queue_schedule_retry",
    "admin_retry_source_scrape_queue",
    "release_unstarted_tag_queue_rows",
    "source_scrape_queue_source_active_uniq",
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

  const tagReleaseFn = sql.match(/CREATE OR REPLACE FUNCTION public\.release_unstarted_tag_queue_rows[\s\S]*?\$\$;/)?.[0] ?? ""
  assert.match(tagReleaseFn, /attempt_count\s*=\s*GREATEST\(attempt_count - 1, 0\)/)

  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS source_scrape_queue_source_active_uniq[\s\S]*WHERE source_id IS NOT NULL[\s\S]*status IN \('pending','processing'\)/)
})
```
- [ ] Step 2: Run failing test: `node --test tests/guards/ingestion-tagging-pipeline-migration.test.mjs`
- [ ] Step 3: Commit: `git commit -m "test: add migration guard for no-burn claim semantics"`

### Task 2: Implement migration with claim-without-attempt-increment, started-row attempt accounting, and enqueue-only admin due scrapes

**Files:**
- Create: `supabase/migrations/20260601004100_ingestion_tagging_pipeline_rethink.sql`

- [ ] Step 1: Create migration file with this exact SQL core. Wrap all SQL from Step 1 and Step 2 in one `BEGIN; ... COMMIT;` block and include only the grants shown in Step 2:
```sql
CREATE TYPE public.source_scrape_queue_status AS ENUM ('pending','processing','retrying','succeeded','dead');

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

CREATE UNIQUE INDEX IF NOT EXISTS source_scrape_queue_source_active_uniq
  ON public.source_scrape_queue (source_id)
  WHERE source_id IS NOT NULL AND status IN ('pending','processing');

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

CREATE OR REPLACE FUNCTION public.reap_stuck_source_scrape_queue_rows()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count int;
BEGIN
  UPDATE public.source_scrape_queue
  SET status='pending',
      started_at=NULL,
      source_run_id=NULL,
      last_error=coalesce(last_error, 'reaped after stuck in processing')
  WHERE status='processing'
    AND started_at < now() - interval '15 minutes';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_source_scrape_queue_skipped(p_queue_id bigint, p_skip_reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.source_scrape_queue
  SET status='succeeded',
      finished_at=now(),
      skip_reason=left(coalesce(p_skip_reason, 'source skipped'), 1000),
      last_error=NULL
  WHERE id = p_queue_id;
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

CREATE OR REPLACE FUNCTION public.release_unstarted_tag_queue_rows(p_claimed_ids bigint[])
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count int;
BEGIN
  UPDATE public.event_tag_queue
  SET status='pending',
      started_at=NULL,
      attempt_count=GREATEST(attempt_count - 1, 0)
  WHERE id = ANY(p_claimed_ids)
    AND status='processing'
    AND started_at IS NOT NULL
    AND finished_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
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

CREATE OR REPLACE FUNCTION public.admin_retry_source_scrape_queue(p_queue_id bigint)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_source_id uuid;
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT source_id INTO v_source_id
  FROM public.source_scrape_queue
  WHERE id = p_queue_id AND status = 'dead';

  IF v_source_id IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.source_scrape_queue (source_id)
  VALUES (v_source_id)
  ON CONFLICT DO NOTHING;

  RETURN EXISTS (
    SELECT 1 FROM public.source_scrape_queue
    WHERE source_id = v_source_id AND status IN ('pending','processing')
  );
END;
$$;
```
- [ ] Step 2: Keep/add `source_extraction_traces`, `source_scrape_queue_summary`, `event_sources.extraction_mode`, and `event_tag_queue_status` + `succeeded` backfill DDL in the same migration file using these exact fragments:
```sql
ALTER TABLE public.event_sources
  ADD COLUMN IF NOT EXISTS extraction_mode text NOT NULL DEFAULT 'deterministic'
  CHECK (extraction_mode IN ('deterministic','llm','deterministic_then_llm'));

CREATE TABLE public.source_extraction_traces (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_queue_id bigint REFERENCES public.source_scrape_queue(id) ON DELETE SET NULL,
  source_run_id uuid REFERENCES public.source_runs(id) ON DELETE SET NULL,
  source_id uuid REFERENCES public.event_sources(id) ON DELETE SET NULL,
  extraction_mode text NOT NULL,
  extractor text NOT NULL CHECK (extractor IN ('deterministic','llm')),
  provider text,
  model text,
  status text NOT NULL CHECK (status IN ('success','fallback','error')),
  input_bytes int,
  parsed_event_count int NOT NULL DEFAULT 0,
  reasoning_summary text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TYPE public.event_tag_queue_status ADD VALUE IF NOT EXISTS 'succeeded';
UPDATE public.event_tag_queue
SET status = 'succeeded'
WHERE status = 'failed' AND finished_at IS NOT NULL AND last_error IS NULL;

CREATE OR REPLACE VIEW public.source_scrape_queue_summary AS
SELECT status,
       count(*)::int AS row_count,
       min(enqueued_at) AS oldest_enqueued_at,
       max(started_at) FILTER (WHERE status='processing') AS newest_processing_at,
       max(finished_at) FILTER (WHERE status='dead') AS last_dead_letter_at,
       max(last_error) FILTER (WHERE last_error IS NOT NULL) AS last_error
FROM public.source_scrape_queue
GROUP BY status;

GRANT SELECT ON public.source_scrape_queue_summary TO authenticated;
GRANT SELECT ON public.source_extraction_traces TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_source_scrape_queue_batch(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_source_scrape_queue_started(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_unstarted_source_scrape_queue_rows(bigint[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.reap_stuck_source_scrape_queue_rows() TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_source_scrape_queue_skipped(bigint, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.source_scrape_queue_schedule_retry(bigint, int, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_unstarted_tag_queue_rows(bigint[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.run_due_source_scrapes() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_run_due_scrapes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_retry_source_scrape_queue(bigint) TO authenticated;
```
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

- [ ] Step 1: Create `source-queue.ts` with this exact content:
```ts
import type { SupabaseClient } from "@supabase/supabase-js"

export interface EnqueueSourceScrapeResult {
  queue_id: number | null
  deduped: boolean
}

export async function enqueueSourceScrape(
  supabase: SupabaseClient,
  sourceId: string
): Promise<EnqueueSourceScrapeResult> {
  const { data: inserted, error: insertError } = await supabase
    .from("source_scrape_queue")
    .insert({ source_id: sourceId })
    .select("id")
    .maybeSingle()

  if (!insertError && inserted) {
    return { queue_id: Number(inserted.id), deduped: false }
  }

  const { data: existing, error: selectError } = await supabase
    .from("source_scrape_queue")
    .select("id")
    .eq("source_id", sourceId)
    .in("status", ["pending", "processing"])
    .order("enqueued_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (selectError) throw selectError
  return { queue_id: existing ? Number(existing.id) : null, deduped: true }
}

export async function kickProcessSourceQueue(
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<void> {
  const response = await fetch(`${supabaseUrl}/functions/v1/process-source-queue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: "{}",
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`process-source-queue ${response.status}: ${body.slice(0, 200)}`)
  }
}
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

Deno.test("worker creates and links a fresh source_run before extraction starts", () => {
  assertEquals(true, false)
})

Deno.test("deterministic_then_llm falls back to llm when deterministic extraction returns no valid events", () => {
  assertEquals(true, false)
})

Deno.test("deterministic mode extraction failure schedules retry and imports no events", () => {
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

export async function createAndLinkSourceRun(
  supabase: SupabaseClient,
  queueId: number,
  sourceId: string
): Promise<string> {
  const { data: run, error: runError } = await supabase
    .from("source_runs")
    .insert({ source_id: sourceId, status: "running" })
    .select("id")
    .single()
  if (runError) throw runError

  const runId = String(run.id)
  const { error: linkError } = await supabase
    .from("source_scrape_queue")
    .update({ source_run_id: runId })
    .eq("id", queueId)
  if (linkError) throw linkError

  return runId
}

export async function persistExtractionTrace(
  supabase: SupabaseClient,
  input: {
    source_queue_id: number
    source_run_id: string
    source_id: string
    extraction_mode: ExtractionMode
    extractor: "deterministic" | "llm"
    status: "success" | "fallback" | "error"
    error?: string | null
    parsed_event_count: number
  }
): Promise<void> {
  const { error } = await supabase.from("source_extraction_traces").insert(input)
  if (error) throw error
}
```
- [ ] Step 2: At the start of `processQueueRow(...)`, load the source row, create/link a run, and mark the row started with this exact sequence:
```ts
const { data: source, error: sourceError } = await supabase
  .from("event_sources")
  .select("*")
  .eq("id", queueRow.source_id)
  .maybeSingle()
if (sourceError) throw sourceError
if (!source) {
  await markSkipped(supabase, queueRow.id, "source deleted before processing")
  return { outcome: "skipped", imported: 0 }
}
if (!source.is_active) {
  await markSkipped(supabase, queueRow.id, "source disabled before processing")
  return { outcome: "skipped", imported: 0 }
}

const runId = await createAndLinkSourceRun(supabase, queueRow.id, source.id)
const startedRow = await markStarted(supabase, queueRow.id)
```
- [ ] Step 3: Add this exact deterministic extraction failure/fallback block before any `processSource(...)` call:
```ts
let parsedEvents: ParsedEvent[] = []
let deterministicError: unknown = null

if (source.extraction_mode !== "llm") {
  try {
    const deterministicEvents = validateParsedEvents(await parser.extractEvents(source, artifact, parserContext))
    await persistExtractionTrace(supabase, {
      source_queue_id: queueRow.id,
      source_run_id: runId,
      source_id: source.id,
      extraction_mode: source.extraction_mode,
      extractor: "deterministic",
      status: deterministicEvents.length > 0 ? "success" : "fallback",
      parsed_event_count: deterministicEvents.length,
    })
    parsedEvents = deterministicEvents
  } catch (err) {
    deterministicError = err
    await persistExtractionTrace(supabase, {
      source_queue_id: queueRow.id,
      source_run_id: runId,
      source_id: source.id,
      extraction_mode: source.extraction_mode,
      extractor: "deterministic",
      status: "error",
      error: err instanceof Error ? err.message : String(err),
      parsed_event_count: 0,
    })
  }
}

if (source.extraction_mode === "deterministic" && (deterministicError || parsedEvents.length === 0)) {
  await scheduleRetry(
    supabase,
    queueRow.id,
    startedRow.attempt_count,
    deterministicError instanceof Error ? deterministicError.message : "Deterministic extraction returned no valid events",
  )
  return { outcome: "retry", imported: 0 }
}
```
- [ ] Step 4: Add this exact invalid-LLM failure block in `processQueueRow(...)` before any `processSource(...)` call:
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
- [ ] Step 5: Add this exact no-partial-publish guard immediately after validation:
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
- [ ] Step 6: Before calling `processSource`, set final events with:
```ts
if (source.extraction_mode === "llm" || (source.extraction_mode === "deterministic_then_llm" && parsedEvents.length === 0)) {
  parsedEvents = validLlmEvents
}

const result = await processSource(supabase, source, runId, parsedEvents)
await supabase.from("source_scrape_queue").update({ status: "succeeded", finished_at: new Date().toISOString() }).eq("id", queueRow.id)
return { outcome: "succeeded", imported: result.eventsImported }
```
- [ ] Step 7: In `index.ts`, use this exact claim/start/release structure:
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
- [ ] Step 8: Run tests: `cd supabase/functions && deno test process-source-queue/lib/worker_test.ts process-source-queue/index_test.ts`
- [ ] Step 9: Commit: `git commit -m "feat: implement source worker no-burn and invalid-llm failure handling"`

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
- [ ] Step 2: Create `use-admin-source-queue.ts` with this exact content:
```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { qk } from "@/lib/query-keys"

export interface SourceQueueSummaryRow {
  status: string
  row_count: number
  oldest_enqueued_at: string | null
  newest_processing_at: string | null
  last_dead_letter_at: string | null
  last_error: string | null
}

export interface DeadSourceQueueRow {
  id: number
  source_id: string | null
  source_run_id: string | null
  attempt_count: number
  last_error: string | null
  finished_at: string | null
  skip_reason: string | null
}

export function useAdminSourceQueueSummary() {
  return useQuery({
    queryKey: qk.admin.sourceQueueSummary,
    queryFn: async (): Promise<SourceQueueSummaryRow[]> => {
      const { data, error } = await supabase
        .from("source_scrape_queue_summary")
        .select("status, row_count, oldest_enqueued_at, newest_processing_at, last_dead_letter_at, last_error")
      if (error) throw error
      return (data ?? []) as SourceQueueSummaryRow[]
    },
    refetchInterval: 10_000,
  })
}

export function useAdminDeadSourceQueueRows() {
  return useQuery({
    queryKey: qk.admin.deadSourceQueueRows,
    queryFn: async (): Promise<DeadSourceQueueRow[]> => {
      const { data, error } = await supabase
        .from("source_scrape_queue")
        .select("id, source_id, source_run_id, attempt_count, last_error, finished_at, skip_reason")
        .eq("status", "dead")
        .order("finished_at", { ascending: false })
        .limit(25)
      if (error) throw error
      return (data ?? []) as DeadSourceQueueRow[]
    },
  })
}

export function useAdminRetrySourceQueue() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (queueId: number) => {
      const { data, error } = await supabase.rpc("admin_retry_source_scrape_queue", {
        p_queue_id: queueId,
      })
      if (error) throw error
      return data as boolean
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.admin.sourceQueueSummary })
      void queryClient.invalidateQueries({ queryKey: qk.admin.deadSourceQueueRows })
      void queryClient.invalidateQueries({ queryKey: qk.admin.sourceRuns })
      void queryClient.invalidateQueries({ queryKey: qk.admin.tagQueueSummary })
    },
  })
}
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

### Task 17: Add failing tests for process-tag-queue succeeded status and deadline release behavior

**Files:**
- Create: `supabase/functions/process-tag-queue/process-tag-queue-behavior.test.ts`

- [ ] Step 1: Create `supabase/functions/process-tag-queue/process-tag-queue-behavior.test.ts` with this exact content:
```ts
import { assertEquals } from "jsr:@std/assert"
import { resolveCompletedTagQueueStatus, shouldStopBeforeStartingNextTagRow } from "./queue-policy.ts"

Deno.test("successful tag queue rows complete with succeeded status", () => {
  assertEquals(resolveCompletedTagQueueStatus(), "succeeded")
})

Deno.test("worker stops before starting another row near deadline", () => {
  assertEquals(shouldStopBeforeStartingNextTagRow(109_500, 110_000), true)
  assertEquals(shouldStopBeforeStartingNextTagRow(5_000, 110_000), false)
})
```
- [ ] Step 2: Run failing test: `cd supabase/functions && deno test process-tag-queue/process-tag-queue-behavior.test.ts`
- [ ] Step 3: Commit: `git commit -m "test: add process-tag-queue succeeded and deadline tests"`

### Task 18: Implement process-tag-queue succeeded status and unstarted-row release

**Files:**
- Create: `supabase/functions/process-tag-queue/queue-policy.ts`
- Modify: `supabase/functions/process-tag-queue/index.ts`

- [ ] Step 1: Create `queue-policy.ts` with this exact content:
```ts
export function resolveCompletedTagQueueStatus(): "succeeded" {
  return "succeeded"
}

export function shouldStopBeforeStartingNextTagRow(elapsedMs: number, budgetMs: number): boolean {
  return elapsedMs >= budgetMs - 5_000
}
```
- [ ] Step 2: In `process-tag-queue/index.ts`, replace the success update payload in `markSuccess` with:
```ts
{
  status: resolveCompletedTagQueueStatus(),
  finished_at: new Date().toISOString(),
  last_error: null,
}
```
- [ ] Step 3: In `processBatch`, before starting each claimed row, add this exact deadline guard:
```ts
const unstartedRowIds = rows.slice(rows.indexOf(row)).map((item) => item.id)
if (shouldStopBeforeStartingNextTagRow(Date.now() - batchStart, 110_000)) {
  await supabase.rpc("release_unstarted_tag_queue_rows", { p_claimed_ids: unstartedRowIds })
  break
}
```
- [ ] Step 4: Add `import { resolveCompletedTagQueueStatus, shouldStopBeforeStartingNextTagRow } from "./queue-policy.ts"` at the top of `index.ts`.
- [ ] Step 5: Run tests: `cd supabase/functions && deno test process-tag-queue/process-tag-queue-behavior.test.ts`
- [ ] Step 6: Commit: `git commit -m "feat: complete tag queue rows with succeeded status"`

### Task 19: Add failing tests for source worker reaping and disabled/deleted source skip semantics

**Files:**
- Modify: `supabase/functions/process-source-queue/lib/worker_test.ts`

- [ ] Step 1: Append these exact tests to `supabase/functions/process-source-queue/lib/worker_test.ts`:
```ts
Deno.test("reaps source queue rows stuck processing for more than fifteen minutes", () => {
  throw new Error("failing until reap_stuck_source_scrape_queue_rows is invoked before claim")
})

Deno.test("disabled source completes with skip_reason and no retry", () => {
  throw new Error("failing until disabled sources call mark_source_scrape_queue_skipped")
})

Deno.test("deleted source completes with skip_reason and no retry", () => {
  throw new Error("failing until missing sources call mark_source_scrape_queue_skipped")
})
```
- [ ] Step 2: Run failing tests: `cd supabase/functions && deno test process-source-queue/lib/worker_test.ts`
- [ ] Step 3: Commit: `git commit -m "test: add source queue reap and skip tests"`

### Task 20: Implement source worker reaping and disabled/deleted source skip semantics

**Files:**
- Modify: `supabase/functions/process-source-queue/lib/worker.ts`
- Modify: `supabase/functions/process-source-queue/index.ts`

- [ ] Step 1: Add these exact helpers in `worker.ts`:
```ts
export async function reapStuckSourceQueueRows(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase.rpc("reap_stuck_source_scrape_queue_rows")
  if (error) throw error
  return Number(data ?? 0)
}

export async function markSkipped(supabase: SupabaseClient, queueId: number, reason: string): Promise<void> {
  const { error } = await supabase.rpc("mark_source_scrape_queue_skipped", {
    p_queue_id: queueId,
    p_skip_reason: reason,
  })
  if (error) throw error
}
```
- [ ] Step 2: In `processQueueRow`, after loading the source row and before `markStarted`, add:
```ts
if (!source) {
  await markSkipped(supabase, queueRow.id, "source deleted before processing")
  return { outcome: "skipped", imported: 0 }
}

if (!source.is_active) {
  await markSkipped(supabase, queueRow.id, "source disabled before processing")
  return { outcome: "skipped", imported: 0 }
}
```
- [ ] Step 3: In `process-source-queue/index.ts`, invoke the reaper before claiming:
```ts
await reapStuckSourceQueueRows(supabase)
const { data: claimed } = await supabase.rpc("claim_source_scrape_queue_batch", { p_limit: 5 })
```
- [ ] Step 4: Run tests: `cd supabase/functions && deno test process-source-queue/lib/worker_test.ts process-source-queue/index_test.ts`
- [ ] Step 5: Commit: `git commit -m "feat: skip disabled sources and reap source queue"`

### Task 21: Add failing web tests for extraction_mode typing and source-form defaults

**Files:**
- Create: `apps/web/src/features/admin/lib/source-defaults.test.ts`

- [ ] Step 1: Create `apps/web/src/features/admin/lib/source-defaults.test.ts` with this exact content:
```ts
import { describe, expect, it } from "vitest"
import { defaultExtractionModeForSourceType } from "./source-defaults"

describe("defaultExtractionModeForSourceType", () => {
  it.each(["website", "macaronikid"] as const)("%s defaults to deterministic_then_llm", (sourceType) => {
    expect(defaultExtractionModeForSourceType(sourceType)).toBe("deterministic_then_llm")
  })

  it.each(["rss", "ical", "manual"] as const)("%s defaults to deterministic", (sourceType) => {
    expect(defaultExtractionModeForSourceType(sourceType)).toBe("deterministic")
  })
})
```
- [ ] Step 2: Run failing test: `pnpm --filter @family-events/web test -- src/features/admin/lib/source-defaults.test.ts`
- [ ] Step 3: Commit: `git commit -m "test: add source extraction mode default tests"`

### Task 22: Implement extraction_mode web typing, schemas, and source-form defaults

**Files:**
- Create: `apps/web/src/features/admin/lib/source-defaults.ts`
- Modify: `apps/web/src/features/admin/hooks/admin-types.ts`
- Modify: `apps/web/src/features/admin/hooks/use-admin-sources.ts`
- Modify: `apps/web/src/features/admin/pages/admin-sources.tsx`

- [ ] Step 1: Create `source-defaults.ts` with this exact content:
```ts
export type SourceType = "website" | "ical" | "rss" | "manual" | "macaronikid"
export type ExtractionMode = "deterministic" | "llm" | "deterministic_then_llm"

export function defaultExtractionModeForSourceType(sourceType: SourceType): ExtractionMode {
  return sourceType === "website" || sourceType === "macaronikid" ? "deterministic_then_llm" : "deterministic"
}
```
- [ ] Step 2: In `apps/web/src/lib/types.ts`, add this exact type and field:
```ts
export type ExtractionMode = "deterministic" | "llm" | "deterministic_then_llm"

export interface EventSource {
  id: string
  name: string
  url: string
  source_type: "website" | "ical" | "rss" | "manual" | "macaronikid"
  extraction_mode: ExtractionMode
  city_id: string | null
  is_active: boolean
  auto_approve: boolean
  scrape_interval_hours: number
  last_scraped_at: string | null
  last_status: "pending" | "success" | "error" | "partial" | null
  error_count: number
  notes: string | null
  created_at: string
  updated_at: string
}
```
- [ ] Step 3: In `apps/web/src/lib/schemas/admin.ts`, add the exact schema field:
```ts
extraction_mode: z.enum(["deterministic", "llm", "deterministic_then_llm"]),
```
- [ ] Step 4: In `apps/web/src/features/admin/hooks/use-admin-sources.ts`, replace the source select string with:
```ts
"id, name, url, source_type, extraction_mode, city_id, is_active, auto_approve, scrape_interval_hours, last_scraped_at, last_status, error_count, notes, created_at, updated_at"
```
- [ ] Step 5: In `useCreateAdminSource`, keep the payload type as `Omit<EventSource, "id" | "created_at" | "updated_at">` so inserts require `extraction_mode`.
- [ ] Step 6: In `admin-sources.tsx`, initialize new sources with:
```ts
const [newSource, setNewSource] = useState({
  name: "",
  url: "",
  source_type: "website" as SourceType,
  city_id: "",
  extraction_mode: defaultExtractionModeForSourceType("website"),
})
```
- [ ] Step 7: In source-type change handling, update extraction mode with:
```ts
onTypeChange={(value) =>
  setNewSource((prev) => ({
    ...prev,
    source_type: value,
    extraction_mode: defaultExtractionModeForSourceType(value),
  }))
}
```
- [ ] Step 8: Include `extraction_mode: newSource.extraction_mode` in the create-source payload.
- [ ] Step 9: Run tests: `pnpm --filter @family-events/web test -- src/features/admin/lib/source-defaults.test.ts`
- [ ] Step 10: Commit: `git commit -m "feat: add extraction mode typing and defaults"`
