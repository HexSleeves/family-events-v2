# Auto-Approve Events by Source

**Date:** 2026-05-10
**Status:** Approved

## Overview

Add a per-source `auto_approve` flag to `event_sources`. When a cron scrape inserts a **new** event from a source with `auto_approve = true`, the event is created with `status: "published"` instead of `"draft"`, bypassing the manual admin review queue. Existing events are never affected. Admins can toggle the flag per-source or bulk-toggle all sources at once.

## Scope

- v1: unconditional auto-approve (flag on = events publish immediately)
- v2 (out of scope here): guardrail pipeline — confidence threshold, keyword filters, external checks — inserted at the same call site

---

## Data Layer

### Migration

Add one nullable-safe column to `event_sources`:

```sql
ALTER TABLE public.event_sources
  ADD COLUMN IF NOT EXISTS auto_approve boolean NOT NULL DEFAULT false;
```

Default `false` preserves existing behavior for all current sources.

### Bulk-Toggle RPC

A `SECURITY DEFINER` function (same pattern as `admin_list_cron_jobs`) so the client never issues an unbounded `UPDATE`:

```sql
CREATE OR REPLACE FUNCTION public.admin_bulk_set_auto_approve(enable boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.event_sources SET auto_approve = enable;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_bulk_set_auto_approve(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_bulk_set_auto_approve(boolean) TO authenticated;
```

RLS on `event_sources` already restricts writes to admins; the RPC is admin-only by grant.

---

## Edge Function

**File:** `supabase/functions/scrape-source/lib/process-source.ts`

Replace the hardcoded `status` at the insert payload (line 445):

```ts
// Before
status: "draft" as const,

// After
status: (!existingEventId && source.auto_approve) ? "published" : "draft",
```

`existingEventId` is already in scope; no new variables needed. The `!existingEventId` guard ensures updates to existing events are never promoted.

### Type Update

`supabase/functions/scrape-source/lib/types.ts` — add to `EventSourceRow`:

```ts
auto_approve: boolean
```

App-level Supabase generated types pick up the column from the migration.

### V2 Extension Point

When guardrails are needed, replace the inline ternary with:

```ts
status: resolveEventStatus(source, parsed, existingEventId),
```

The `resolveEventStatus` function encapsulates the full guardrail pipeline. The call site and surrounding code are unchanged.

---

## Admin UI

### Per-Source Toggle

Each row in `AdminSourcesList` gains an `auto_approve` toggle switch alongside the existing `is_active` toggle. On change, calls the existing `useUpdateAdminSource` hook:

```ts
updateSource.mutateAsync({ sourceId, updates: { auto_approve: !source.auto_approve } })
```

No new hook required.

### Bulk-Toggle

`AdminSourcesHeader` gains two buttons: **Enable All Auto-Approve** and **Disable All Auto-Approve**. A new `useAdminBulkSetAutoApprove` mutation calls the `admin_bulk_set_auto_approve` RPC then invalidates the sources query.

### Visual Indicator

Each source row shows an `auto_approve` badge (same treatment as `is_active`) so the state is scannable at a glance without opening a detail view.

---

## What Is Explicitly Out of Scope

- Global master switch (no `app_settings` table)
- Auto-approve on event updates (re-scrapes of existing events)
- Any confidence threshold or guardrail logic (v2)
- Audit logging of auto-approved events (can be added in v2)
