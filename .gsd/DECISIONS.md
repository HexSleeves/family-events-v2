# Decisions Register

<!-- Append-only. Never edit or remove existing rows.
     To reverse a decision, add a new row that supersedes it.
     Read this file at the start of any planning or research phase. -->

| # | When | Scope | Decision | Choice | Rationale | Revisable? | Made By |
|---|------|-------|----------|--------|-----------|------------|---------|
| D001 | M002 | architecture | Vector storage for event similarity | pgvector with OpenAI text-embedding-3-small (1536 dims) in a dedicated event_embeddings table | pgvector is native to Supabase (no external service), embedding-3-small is cheap ($0.02/1M tokens) and fast, separate table keeps the events table lean (~6KB per embedding row). Alternatives considered: Pinecone/Weaviate (overkill for scale), column on events table (bloats hot table), full-text search only (misses semantic similarity). | Yes | collaborative |
| D002 | M002 | architecture | Admin feedback capture mechanism | Postgres trigger on events table that writes to admin_event_decisions table on status transitions | Captures ALL admin actions regardless of client (web, direct SQL, future mobile admin). Cannot be bypassed by client-side bugs. Alternatives: application-level event emitter (misses direct SQL), audit log parsing (fragile, delayed). | Yes | collaborative |
| D003 | M002 | architecture | Feature flag strategy for memory features | Independent rows in existing ai_feature_config table for tag-memory, review-memory, and source-auto-reject | Reuses existing pattern (tagging and review already use ai_feature_config). Each memory layer has its own kill switch. No code deploy needed to toggle. Default is off (safe pre-M002 behavior). | Yes | collaborative |
