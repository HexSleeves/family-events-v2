# GSD State

**Active Milestone:** M001: Production Readiness and Open Registration
**Active Slice:** None
**Phase:** completing-milestone
**Requirements Status:** 0 active · 12 validated · 0 deferred · 3 out of scope

## Milestone Registry
- 🔄 **M001:** Production Readiness and Open Registration

## Recent Decisions
- D001 (M001): How to handle the invite code gate for public launch -> Disable via app.settings.require_invite GUC rather than removing invite infrastructure. Preserve all DB tables, triggers, RPCs, and admin UI.
- D002 (M001): How consumer-facing pages determine invite gate state -> All pages query the existing invites_required() RPC via useInvitesRequired() hook. No new API surface or feature flag system.
- D003 (M001): Bundle splitting strategy for index chunk -> Extend Vite manualChunks to extract date-fns, radix-ui, and supabase-js into separate vendor chunks. Target: no chunk over 500KB except maplibre.

## Blockers
- None

## Next Action
All slices complete in M001. Write milestone summary.
