# Decisions Register

<!-- Append-only. Never edit or remove existing rows.
     To reverse a decision, add a new row that supersedes it.
     Read this file at the start of any planning or research phase. -->

| # | When | Scope | Decision | Choice | Rationale | Revisable? | Made By |
|---|------|-------|----------|--------|-----------|------------|---------|
| D001 | M001 | architecture | How to handle the invite code gate for public launch | Disable via app.settings.require_invite GUC rather than removing invite infrastructure. Preserve all DB tables, triggers, RPCs, and admin UI. | User wants the ability to re-enable the gate in the future. The existing architecture already supports both states. Removing infrastructure is irreversible. | Yes | collaborative |
| D002 | M001 | architecture | How consumer-facing pages determine invite gate state | All pages query the existing invites_required() RPC via useInvitesRequired() hook. No new API surface or feature flag system. | The RPC already exists and the sign-up page already uses it partially. Extending the pattern to sign-in and marketing is the simplest path with no new abstractions. | Yes | collaborative |
| D003 | M001 | architecture | Bundle splitting strategy for index chunk | Extend Vite manualChunks to extract date-fns, radix-ui, and supabase-js into separate vendor chunks. Target: no chunk over 500KB except maplibre. | maplibre is inherently large (WebGL). recharts, sentry, motion already isolated. Remaining index chunk contains framework deps that can be split without affecting lazy loading or adding excessive HTTP overhead. | Yes | collaborative |
