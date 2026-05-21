# Ingestion And Tagging Pipeline Rethink — Design Spec

**Date:** 2026-05-21
**Status:** Draft

## Summary
Replace synchronous source scraping with a durable source queue, keep tagging on the durable tag queue, and add per-source hybrid extraction so admin/manual triggers and scheduled sweeps enqueue work quickly while background workers handle fetch, extraction, import, and tagging with bounded retries and clear operator visibility.

## Chosen Approach
Keep the current public trigger surface stable and move the work behind it. `scrape-source` stops doing ingestion inline and becomes an enqueue-only entrypoint for one source or a due-source sweep. A new `process-source-queue` worker, scheduled the same way as `process-tag-queue`, claims queue rows with `SKIP LOCKED`, creates a fresh `source_run` for each attempt, runs the existing import pipeline for exactly one source at a time, and retries or dead-letters failed rows. This is the lowest-churn path because the admin UI, cron callers, and deploy topology already assume Supabase Edge Functions plus Railway cron services.

For extraction, split "fetch source content" from "turn fetched content into `ParsedEvent[]`". Existing parser logic becomes the deterministic extractor. A new LLM extractor consumes only the already-fetched artifact body plus source metadata; it never drives a browser, executes page JS, or autonomously explores links. `event_sources.extraction_mode` controls whether a source stays deterministic, uses LLM only, or falls back from deterministic to LLM when deterministic extraction yields no valid events.

## Alternatives Considered
Keep synchronous scraping and only improve `event_tag_queue`. Rejected because the current timeout risk lives earlier in the pipeline: `scrape-source` still fetches, parses, geocodes, imports, and enqueues tags inline, which leaves `source_runs` vulnerable to long-running HTML sources even if tagging is async.

Push both queues into an external broker. Rejected because it adds new infrastructure, auth, and observability paths when the repo already has working Postgres queue patterns, Railway cron services, and admin hooks around Supabase-backed state.

Use an autonomous browser/agent extractor for hard sites. Rejected explicitly. The LLM extraction path is limited to fetched HTML, XML, JSON, and derived plain text from the existing source URL only.

## Components
- `supabase/migrations/*`: add `source_scrape_queue`, `source_scrape_queue_status`, claim/reap/retry RPCs, `source_scrape_queue_summary`, `source_extraction_traces`, and `event_sources.extraction_mode`; backfill existing sources to `deterministic`; add `succeeded` to `event_tag_queue_status`; backfill legacy tag rows that used `failed` as "done" into `succeeded`.
- `supabase/functions/scrape-source/index.ts`: keep auth and request shape, but only enqueue a source row, mark the source as pending, and opportunistically kick `process-source-queue`.
- `supabase/functions/scrape-due-sources/index.ts` plus `run_due_source_scrapes`/`admin_run_due_scrapes`: enqueue due sources instead of invoking full scrapes.
- `supabase/functions/process-source-queue/index.ts`: reap stuck source rows, claim a bounded batch with `SKIP LOCKED`, process at most one source queue row per invocation, create/link a new `source_run`, and release any unstarted claimed rows before the wall-clock deadline.
- `supabase/functions/scrape-source/lib/process-source.ts`: stop creating `source_runs` internally; accept `runId` plus an extraction result and remain the source-at-a-time import/enqueue engine.
- `supabase/functions/scrape-source/parsers/_lib/types.ts` and parser modules: split fetch from deterministic extraction so the same fetched artifact can feed deterministic and LLM extraction.
- New shared extraction code under `supabase/functions/scrape-source/lib/` or `parsers/_lib/`: normalize fetched artifacts, validate `ParsedEvent[]`, and persist `source_extraction_traces`.
- `supabase/functions/process-tag-queue/index.ts`: write `succeeded`, never use `failed` for success again, and release unstarted claimed rows when the function nears its deadline.
- New Railway cron app `apps/cron-process-source-queue/*`: call `process-source-queue` every minute. Existing `apps/cron-scrape-sources/*` remains the hourly enqueue sweep.
- `apps/web/src/features/admin/hooks/*` and `apps/web/src/features/admin/pages/admin-logs.tsx`: add source-queue summary/dead-letter hooks, surface both queue dashboards, and add retry actions for dead source rows and dead tag rows.
- `apps/web/src/lib/types.ts`, schemas, and admin source forms: add `extraction_mode` to source typing and editing. New-source defaults are `deterministic_then_llm` for `website` and `macaronikid`, `deterministic` for `rss`, `ical`, and `manual`.

## Data Flow
1. Admin "Scrape Now", "Scrape All", and scheduled due-source sweeps all enqueue into `source_scrape_queue` and return immediately. A partial unique index on active rows (`source_id` where status in `pending`,`processing`) collapses duplicate clicks or overlapping sweeps into one active row.
2. `process-source-queue` reaps stuck rows after 15 minutes in `processing`, claims a small batch ordered by `next_attempt_at`, then fully processes only the first claimed source. Any additional claimed-but-unstarted rows are returned to `pending` before exit so attempts are not burned just because the worker ran out of time. Source rows retry with backoff at 5 minutes, 15 minutes, and 60 minutes, then dead-letter on the fourth failure.
3. When a row actually starts, the worker creates a new `source_runs` row, stores that `source_run_id` on the queue row, loads the source, fetches the remote artifact once, chooses extraction based on `event_sources.extraction_mode`, and records each extraction attempt in `source_extraction_traces`.
4. Extraction behavior:
   - `deterministic`: run the existing parser logic only.
   - `llm`: skip deterministic extraction and ask the LLM to return validated `ParsedEvent[]` from the fetched artifact.
   - `deterministic_then_llm`: accept deterministic output if it yields at least one valid event; otherwise invoke the LLM on the same fetched artifact.
5. The import path upserts events, respects admin field locks, geocodes as it does today, and enqueues `event_tag_queue` rows for imported events.
6. `process-tag-queue` keeps batch claiming, but successful rows move to `succeeded`. Before the function reaches an approximately 110-second deadline, any claimed rows it has not started are released back to `pending`; only started rows consume an attempt and enter the existing 1/2/4/8/16-minute retry policy and fifth-attempt dead-letter logic.
7. Admin Logs reads `source_scrape_queue_summary`, `event_tag_queue_summary`, recent dead rows, and recent `source_runs` so operators can see depth, oldest pending age, active processing age, dead-letter counts, last errors, and retry buttons from one page.

## Edge Cases
- A source is queued twice before the first row finishes: the second enqueue is a no-op and returns the existing active row metadata.
- A source is disabled or deleted after enqueue but before processing: the worker marks the queue row complete without retry and records a skip reason instead of dead-lettering operator intent.
- A worker crashes after claiming a row: the queue reaper returns the row to `pending`; stale `source_runs` continue to be cleaned up by the existing timeout job.
- Deterministic extraction returns malformed or zero events: `deterministic_then_llm` falls back to LLM; `deterministic` records the failure and retries/dead-letters the source row.
- LLM extraction returns invalid JSON or invalid `ParsedEvent` shapes: the attempt is traced, treated as a source-queue failure, and retried with backoff; it does not silently publish partial garbage.
- Legacy tag rows already marked `failed`: the migration backfills known success rows to `succeeded` before the admin UI switches labels, so queue counts stay meaningful during rollout.

## Out of Scope
- Changing the event-tag classification prompt, tag taxonomy, or `event_ai_traces` schema beyond queue-status linkage.
- Browser automation, JS-rendered crawling, multi-page discovery, or autonomous agent extraction.
- Replacing Railway cron with another scheduler.
- Automatic per-source extraction-mode tuning or cost-based mode switching.
