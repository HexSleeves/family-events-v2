# Requirements

This file is the explicit capability and coverage contract for the project.

## Active

## Validated

### R001 — Events have vector embeddings generated from title+description via OpenAI text-embedding-3-small. An `event_embeddings` table with pgvector stores (event_id, embedding vector(1536), model, created_at). A Postgres function `find_similar_events` returns the N most similar events by cosine distance.
- Class: core-capability
- Status: validated
- Description: Events have vector embeddings generated from title+description via OpenAI text-embedding-3-small. An `event_embeddings` table with pgvector stores (event_id, embedding vector(1536), model, created_at). A Postgres function `find_similar_events` returns the N most similar events by cosine distance.
- Why it matters: Similarity retrieval is the foundation for memory-augmented tagging and review. Without embeddings, the pipeline cannot find relevant past decisions to learn from.
- Source: M002
- Primary owning slice: M002/S01
- Validation: pgvector extension enabled via migration 20260601020000. event_embeddings table with HNSW index (m=16, ef=64, vector_cosine_ops). find_similar_events as private+public wrapper RPC. embed-event edge function with 9 passing Deno tests. S01 SUMMARY confirms all criteria met.

### R002 — Every admin status change on events (draft→published, draft→rejected, tag edits) is recorded in an `admin_event_decisions` table with event_id, admin_user_id, old_status, new_status, old_tags, new_tags, reason, and timestamp. This captures ground truth for pipeline learning.
- Class: core-capability
- Status: validated
- Description: Every admin status change on events (draft→published, draft→rejected, tag edits) is recorded in an `admin_event_decisions` table with event_id, admin_user_id, old_status, new_status, old_tags, new_tags, reason, and timestamp. This captures ground truth for pipeline learning.
- Why it matters: Admin decisions are the highest-quality signal for the pipeline to learn from. Without capturing them structurally, every admin correction is lost context.
- Source: M002
- Primary owning slice: M002/S02
- Validation: admin_event_decisions table created via migration 20260601021000 with event_id, admin_user_id, old_status, new_status, old_tags, new_tags, reason, RLS, and indexes. Recording via admin RPCs (not trigger). Web admin visibility-fields.tsx includes reason textarea. S02 SUMMARY confirms.

### R003 — All existing events without embeddings are backfilled via a batch edge function. New events are embedded automatically after tag-event classification. The backfill processes in batches of 50-100 with rate limiting for the OpenAI embeddings API.
- Class: core-capability
- Status: validated
- Description: All existing events without embeddings are backfilled via a batch edge function. New events are embedded automatically after tag-event classification. The backfill processes in batches of 50-100 with rate limiting for the OpenAI embeddings API.
- Why it matters: The similarity layer is useless without embeddings on existing events. Automatic embedding on new events ensures the memory grows without manual intervention.
- Source: M002
- Primary owning slice: M002/S03
- Validation: backfill-embeddings edge function processes batches of 50 with rate limiting. tag-event auto-embeds after classification (non-fatal). 6 backfill tests + 7 tag-event tests pass. S03 SUMMARY confirms.

### R004 — tag-event retrieves the 3-5 most similar previously-tagged events (with their approved tags, confidence, and any admin corrections) and injects them as few-shot context in the LLM tagging prompt. Manual tag overrides get priority in the context. Feature-flagged via ai_feature_config.
- Class: core-capability
- Status: validated
- Description: tag-event retrieves the 3-5 most similar previously-tagged events (with their approved tags, confidence, and any admin corrections) and injects them as few-shot context in the LLM tagging prompt. Manual tag overrides get priority in the context. Feature-flagged via ai_feature_config.
- Why it matters: Currently every event is tagged from scratch. Similar events should produce similar tags. Admin corrections on similar events should propagate as learned context, reducing future mistakes.
- Source: M002
- Primary owning slice: M002/S04
- Validation: memory-context.ts exports fetchSimilarEventTagContext + formatTagMemoryPrompt. tag-event handler checks tag-memory flag, retrieves 5 similar events, formats with [ADMIN CORRECTED] markers. 7 memory-context tests pass. S04 SUMMARY confirms.

### R005 — event-review retrieves similar events with their review outcomes (approved/rejected/admin-overridden) and injects them as context in the review LLM prompt. Confidence is boosted when similar events were consistently approved, and penalized when similar events were rejected. Feature-flagged independently from tagging memory.
- Class: core-capability
- Status: validated
- Description: event-review retrieves similar events with their review outcomes (approved/rejected/admin-overridden) and injects them as context in the review LLM prompt. Confidence is boosted when similar events were consistently approved, and penalized when similar events were rejected. Feature-flagged independently from tagging memory.
- Why it matters: The review pipeline treats every event as novel even when identical events from the same source have been reviewed before. Memory reduces unnecessary admin escalations and improves auto-approve/reject accuracy.
- Source: M002
- Primary owning slice: M002/S05
- Validation: memory-context.ts exports fetchSimilarReviewContext + formatReviewMemoryPrompt. reviewer.ts applies confidenceDelta (clamped 0-1), flags memory_confidence_boosted/penalized. Worker checks review-memory flag. S05 SUMMARY confirms.

### R006 — Sources with >80% rejection rate over the last N events are auto-rejected without LLM review (flagged for admin visibility). An admin dashboard widget shows pipeline learning metrics: auto-processed vs admin-reviewed events, rejection patterns by source, similarity hit rates.
- Class: core-capability
- Status: validated
- Description: Sources with >80% rejection rate over the last N events are auto-rejected without LLM review (flagged for admin visibility). An admin dashboard widget shows pipeline learning metrics: auto-processed vs admin-reviewed events, rejection patterns by source, similarity hit rates.
- Why it matters: Persistent bad sources waste LLM tokens and admin time. Aggregate patterns should drive automatic decisions. Observability lets the admin understand and trust the adaptive behavior.
- Source: M002
- Primary owning slice: M002/S06
- Validation: Migration 20260601022000 creates should_auto_reject_source RPC (>80% threshold, min 5, 30-day). Worker checks flag, calls RPC, sets source_auto_rejected. admin-pipeline-learning.tsx shows automation rate, memory hits, top rejection sources. S06 SUMMARY confirms.

### R007 — All existing tests continue to pass (pnpm run verify:web). No regressions from embedding infrastructure, feedback capture, or prompt modifications. New edge function tests cover embedding generation, similarity retrieval, memory-augmented prompts, and auto-reject logic.
- Class: quality-attribute
- Status: validated
- Description: All existing tests continue to pass (pnpm run verify:web). No regressions from embedding infrastructure, feedback capture, or prompt modifications. New edge function tests cover embedding generation, similarity retrieval, memory-augmented prompts, and auto-reject logic.
- Why it matters: Pipeline changes must not break existing classification or review behavior. The feature-flag pattern ensures safe rollout.
- Source: M002
- Validation: 432 web tests, 53 guards, 29 Deno tests all pass. 0 lint/format errors. pnpm run verify:web exits 0. Every slice SUMMARY confirms no regressions.

### R008 — All memory features (tag memory, review memory, auto-reject) are independently feature-flagged via ai_feature_config rows. Each can be enabled/disabled without code changes.
- Class: constraint
- Status: validated
- Description: All memory features (tag memory, review memory, auto-reject) are independently feature-flagged via ai_feature_config rows. Each can be enabled/disabled without code changes.
- Why it matters: Adaptive behavior must be opt-in and independently controllable. A bad similarity match should not force disabling the entire pipeline — each layer needs its own kill switch.
- Source: M002
- Validation: ai_feature_config has rows for tag-memory, review-memory, source-auto-reject (default disabled). Each code path gates independently via isMemoryFeatureEnabled with early-return when disabled. S01/S04/S05/S06 SUMMARYs confirm.

## Deferred

## Out of Scope

## Traceability

| ID | Class | Status | Primary owner | Supporting | Proof |
|---|---|---|---|---|---|
| R001 | core-capability | validated | M002/S01 | none | pgvector extension enabled via migration 20260601020000. event_embeddings table with HNSW index (m=16, ef=64, vector_cosine_ops). find_similar_events as private+public wrapper RPC. embed-event edge function with 9 passing Deno tests. S01 SUMMARY confirms all criteria met. |
| R002 | core-capability | validated | M002/S02 | none | admin_event_decisions table created via migration 20260601021000 with event_id, admin_user_id, old_status, new_status, old_tags, new_tags, reason, RLS, and indexes. Recording via admin RPCs (not trigger). Web admin visibility-fields.tsx includes reason textarea. S02 SUMMARY confirms. |
| R003 | core-capability | validated | M002/S03 | none | backfill-embeddings edge function processes batches of 50 with rate limiting. tag-event auto-embeds after classification (non-fatal). 6 backfill tests + 7 tag-event tests pass. S03 SUMMARY confirms. |
| R004 | core-capability | validated | M002/S04 | none | memory-context.ts exports fetchSimilarEventTagContext + formatTagMemoryPrompt. tag-event handler checks tag-memory flag, retrieves 5 similar events, formats with [ADMIN CORRECTED] markers. 7 memory-context tests pass. S04 SUMMARY confirms. |
| R005 | core-capability | validated | M002/S05 | none | memory-context.ts exports fetchSimilarReviewContext + formatReviewMemoryPrompt. reviewer.ts applies confidenceDelta (clamped 0-1), flags memory_confidence_boosted/penalized. Worker checks review-memory flag. S05 SUMMARY confirms. |
| R006 | core-capability | validated | M002/S06 | none | Migration 20260601022000 creates should_auto_reject_source RPC (>80% threshold, min 5, 30-day). Worker checks flag, calls RPC, sets source_auto_rejected. admin-pipeline-learning.tsx shows automation rate, memory hits, top rejection sources. S06 SUMMARY confirms. |
| R007 | quality-attribute | validated | none | none | 432 web tests, 53 guards, 29 Deno tests all pass. 0 lint/format errors. pnpm run verify:web exits 0. Every slice SUMMARY confirms no regressions. |
| R008 | constraint | validated | none | none | ai_feature_config has rows for tag-memory, review-memory, source-auto-reject (default disabled). Each code path gates independently via isMemoryFeatureEnabled with early-return when disabled. S01/S04/S05/S06 SUMMARYs confirm. |

## Coverage Summary

- Active requirements: 0
- Mapped to slices: 0
- Validated: 8 (R001, R002, R003, R004, R005, R006, R007, R008)
- Unmapped active requirements: 0
