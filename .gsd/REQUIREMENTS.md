# Requirements

This file is the explicit capability and coverage contract for the project.

## Active

### R001 — Events have vector embeddings generated from title+description via OpenAI text-embedding-3-small. An `event_embeddings` table with pgvector stores (event_id, embedding vector(1536), model, created_at). A Postgres function `find_similar_events` returns the N most similar events by cosine distance.
- Class: core-capability
- Status: active
- Description: Events have vector embeddings generated from title+description via OpenAI text-embedding-3-small. An `event_embeddings` table with pgvector stores (event_id, embedding vector(1536), model, created_at). A Postgres function `find_similar_events` returns the N most similar events by cosine distance.
- Why it matters: Similarity retrieval is the foundation for memory-augmented tagging and review. Without embeddings, the pipeline cannot find relevant past decisions to learn from.
- Source: M002
- Primary owning slice: M002/S01
- Validation: pgvector extension enabled. event_embeddings table exists with HNSW or IVFFlat index. find_similar_events RPC returns correct results for known test events. Embedding generation edge function returns 200 with valid 1536-dim vectors.

### R002 — Every admin status change on events (draft→published, draft→rejected, tag edits) is recorded in an `admin_event_decisions` table with event_id, admin_user_id, old_status, new_status, old_tags, new_tags, reason, and timestamp. This captures ground truth for pipeline learning.
- Class: core-capability
- Status: active
- Description: Every admin status change on events (draft→published, draft→rejected, tag edits) is recorded in an `admin_event_decisions` table with event_id, admin_user_id, old_status, new_status, old_tags, new_tags, reason, and timestamp. This captures ground truth for pipeline learning.
- Why it matters: Admin decisions are the highest-quality signal for the pipeline to learn from. Without capturing them structurally, every admin correction is lost context.
- Source: M002
- Primary owning slice: M002/S02
- Validation: admin_event_decisions table exists with correct columns and RLS. DB trigger fires on admin-initiated status transitions. Web admin event-edit page writes reason to the table. At least one admin decision is recorded end-to-end.

### R003 — All existing events without embeddings are backfilled via a batch edge function. New events are embedded automatically after tag-event classification. The backfill processes in batches of 50-100 with rate limiting for the OpenAI embeddings API.
- Class: core-capability
- Status: active
- Description: All existing events without embeddings are backfilled via a batch edge function. New events are embedded automatically after tag-event classification. The backfill processes in batches of 50-100 with rate limiting for the OpenAI embeddings API.
- Why it matters: The similarity layer is useless without embeddings on existing events. Automatic embedding on new events ensures the memory grows without manual intervention.
- Source: M002
- Primary owning slice: M002/S03
- Validation: All existing events have rows in event_embeddings. New events created by tag-event also get embeddings. Backfill edge function completes without dead letters.

### R004 — tag-event retrieves the 3-5 most similar previously-tagged events (with their approved tags, confidence, and any admin corrections) and injects them as few-shot context in the LLM tagging prompt. Manual tag overrides get priority in the context. Feature-flagged via ai_feature_config.
- Class: core-capability
- Status: active
- Description: tag-event retrieves the 3-5 most similar previously-tagged events (with their approved tags, confidence, and any admin corrections) and injects them as few-shot context in the LLM tagging prompt. Manual tag overrides get priority in the context. Feature-flagged via ai_feature_config.
- Why it matters: Currently every event is tagged from scratch. Similar events should produce similar tags. Admin corrections on similar events should propagate as learned context, reducing future mistakes.
- Source: M002
- Primary owning slice: M002/S04
- Validation: tag-event handler includes similar-event context in LLM prompt when feature flag is enabled. AI traces record that memory context was used. Tags on a new event similar to an admin-corrected event reflect the correction.

### R005 — event-review retrieves similar events with their review outcomes (approved/rejected/admin-overridden) and injects them as context in the review LLM prompt. Confidence is boosted when similar events were consistently approved, and penalized when similar events were rejected. Feature-flagged independently from tagging memory.
- Class: core-capability
- Status: active
- Description: event-review retrieves similar events with their review outcomes (approved/rejected/admin-overridden) and injects them as context in the review LLM prompt. Confidence is boosted when similar events were consistently approved, and penalized when similar events were rejected. Feature-flagged independently from tagging memory.
- Why it matters: The review pipeline treats every event as novel even when identical events from the same source have been reviewed before. Memory reduces unnecessary admin escalations and improves auto-approve/reject accuracy.
- Source: M002
- Primary owning slice: M002/S05
- Validation: event-review prompt includes similar-event outcomes when feature flag is enabled. Review traces record memory context usage. Confidence thresholds shift based on similar event history.

### R006 — Sources with >80% rejection rate over the last N events are auto-rejected without LLM review (flagged for admin visibility). An admin dashboard widget shows pipeline learning metrics: auto-processed vs admin-reviewed events, rejection patterns by source, similarity hit rates.
- Class: core-capability
- Status: active
- Description: Sources with >80% rejection rate over the last N events are auto-rejected without LLM review (flagged for admin visibility). An admin dashboard widget shows pipeline learning metrics: auto-processed vs admin-reviewed events, rejection patterns by source, similarity hit rates.
- Why it matters: Persistent bad sources waste LLM tokens and admin time. Aggregate patterns should drive automatic decisions. Observability lets the admin understand and trust the adaptive behavior.
- Source: M002
- Primary owning slice: M002/S06
- Validation: Events from high-rejection sources skip LLM review and are auto-rejected with correct flag. Admin dashboard shows learning metrics. Full pipeline loop (scrape→embed→tag→review→feedback→improved next cycle) verified end-to-end.

### R007 — All existing tests continue to pass (pnpm run verify:web). No regressions from embedding infrastructure, feedback capture, or prompt modifications. New edge function tests cover embedding generation, similarity retrieval, memory-augmented prompts, and auto-reject logic.
- Class: quality-attribute
- Status: active
- Description: All existing tests continue to pass (pnpm run verify:web). No regressions from embedding infrastructure, feedback capture, or prompt modifications. New edge function tests cover embedding generation, similarity retrieval, memory-augmented prompts, and auto-reject logic.
- Why it matters: Pipeline changes must not break existing classification or review behavior. The feature-flag pattern ensures safe rollout.
- Source: M002
- Validation: pnpm run verify:web passes end-to-end. New Deno tests for embed-event, memory retrieval, and auto-reject logic pass. Existing tag-event and event-review tests pass unchanged.

### R008 — All memory features (tag memory, review memory, auto-reject) are independently feature-flagged via ai_feature_config rows. Each can be enabled/disabled without code changes.
- Class: constraint
- Status: active
- Description: All memory features (tag memory, review memory, auto-reject) are independently feature-flagged via ai_feature_config rows. Each can be enabled/disabled without code changes.
- Why it matters: Adaptive behavior must be opt-in and independently controllable. A bad similarity match should not force disabling the entire pipeline — each layer needs its own kill switch.
- Source: M002
- Validation: ai_feature_config has rows for tag-memory, review-memory, and source-auto-reject. Toggling each off falls back to current stateless behavior.

## Validated

## Deferred

## Out of Scope

## Traceability

| ID | Class | Status | Primary owner | Supporting | Proof |
|---|---|---|---|---|---|
| R001 | core-capability | active | M002/S01 | none | pgvector extension enabled. event_embeddings table exists with HNSW or IVFFlat index. find_similar_events RPC returns correct results for known test events. Embedding generation edge function returns 200 with valid 1536-dim vectors. |
| R002 | core-capability | active | M002/S02 | none | admin_event_decisions table exists with correct columns and RLS. DB trigger fires on admin-initiated status transitions. Web admin event-edit page writes reason to the table. At least one admin decision is recorded end-to-end. |
| R003 | core-capability | active | M002/S03 | none | All existing events have rows in event_embeddings. New events created by tag-event also get embeddings. Backfill edge function completes without dead letters. |
| R004 | core-capability | active | M002/S04 | none | tag-event handler includes similar-event context in LLM prompt when feature flag is enabled. AI traces record that memory context was used. Tags on a new event similar to an admin-corrected event reflect the correction. |
| R005 | core-capability | active | M002/S05 | none | event-review prompt includes similar-event outcomes when feature flag is enabled. Review traces record memory context usage. Confidence thresholds shift based on similar event history. |
| R006 | core-capability | active | M002/S06 | none | Events from high-rejection sources skip LLM review and are auto-rejected with correct flag. Admin dashboard shows learning metrics. Full pipeline loop (scrape→embed→tag→review→feedback→improved next cycle) verified end-to-end. |
| R007 | quality-attribute | active | none | none | pnpm run verify:web passes end-to-end. New Deno tests for embed-event, memory retrieval, and auto-reject logic pass. Existing tag-event and event-review tests pass unchanged. |
| R008 | constraint | active | none | none | ai_feature_config has rows for tag-memory, review-memory, and source-auto-reject. Toggling each off falls back to current stateless behavior. |

## Coverage Summary

- Active requirements: 8
- Mapped to slices: 8
- Validated: 0
- Unmapped active requirements: 0
