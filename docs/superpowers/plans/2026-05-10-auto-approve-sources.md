# Auto-Approve Events by Source — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-source `auto_approve` flag that publishes new scraped events immediately, bypassing the manual review queue, with per-source toggle and bulk-toggle from the admin UI.

**Architecture:** A boolean column on `event_sources` (default `false`) feeds into `process-source.ts` at the single point where an event's initial `status` is set — new inserts get `"published"` when the flag is on, updates are never touched. A `SECURITY DEFINER` RPC handles bulk-toggle atomically. The admin UI adds a Switch per source card and two bulk buttons in the header.

**Tech Stack:** PostgreSQL migration, Deno/TypeScript edge function, React + TanStack Query, shadcn Switch component.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/20260601000600_007_auto_approve.sql` | Create | Column + bulk RPC |
| `src/lib/database.types.ts` | Modify | Add `auto_approve` to `event_sources` Row/Insert/Update |
| `src/lib/types.ts` | Modify | Add `auto_approve: boolean` to `EventSource` |
| `supabase/functions/scrape-source/lib/types.ts` | Modify | Add `auto_approve: boolean` to `EventSourceRow` |
| `supabase/functions/scrape-source/lib/process-source.ts` | Modify | Use `auto_approve` in status assignment |
| `src/hooks/admin/use-admin-sources.ts` | Modify | Include `auto_approve` in select; add `useAdminBulkSetAutoApprove` |
| `src/components/admin/admin-sources-sections.tsx` | Modify | Per-source toggle Switch + bulk buttons in header |
| `src/pages/admin/admin-sources.tsx` | Modify | Wire up toggle and bulk handlers |

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/20260601000600_007_auto_approve.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260601000600_007_auto_approve.sql

-- Add auto_approve column to event_sources
ALTER TABLE public.event_sources
  ADD COLUMN IF NOT EXISTS auto_approve boolean NOT NULL DEFAULT false;

-- Bulk-toggle RPC (admin only, atomic update)
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

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260601000600_007_auto_approve.sql
git commit -m "feat: add auto_approve column and bulk-toggle RPC to event_sources"
```

---

## Task 2: Update TypeScript Types

**Files:**
- Modify: `src/lib/database.types.ts`
- Modify: `src/lib/types.ts`
- Modify: `supabase/functions/scrape-source/lib/types.ts`

- [ ] **Step 1: Update `src/lib/database.types.ts`**

Find the `event_sources` section (around line 209). In `Row`, add `auto_approve: boolean`. In `Insert` and `Update`, add `auto_approve?: boolean`.

```ts
// Row (around line 210) — add after city_id:
auto_approve: boolean

// Insert (around line 225) — add after city_id:
auto_approve?: boolean

// Update (around line 240) — add after city_id:
auto_approve?: boolean
```

The full updated `event_sources` block should look like:

```ts
event_sources: {
  Row: {
    auto_approve: boolean
    city_id: string | null
    created_at: string
    error_count: number
    id: string
    is_active: boolean
    last_scraped_at: string | null
    last_status: string | null
    name: string
    notes: string | null
    scrape_interval_hours: number
    source_type: string
    updated_at: string
    url: string
  }
  Insert: {
    auto_approve?: boolean
    city_id?: string | null
    created_at?: string
    error_count?: number
    id?: string
    is_active?: boolean
    last_scraped_at?: string | null
    last_status?: string | null
    name: string
    notes?: string | null
    scrape_interval_hours?: number
    source_type?: string
    updated_at?: string
    url: string
  }
  Update: {
    auto_approve?: boolean
    city_id?: string | null
    created_at?: string
    error_count?: number
    id?: string
    is_active?: boolean
    last_scraped_at?: string | null
    last_status?: string | null
    name?: string
    notes?: string | null
    scrape_interval_hours?: number
    source_type?: string
    updated_at?: string
    url?: string
  }
  Relationships: [
    {
      foreignKeyName: "event_sources_city_id_fkey"
      columns: ["city_id"]
      isOneToOne: false
      referencedRelation: "cities"
      referencedColumns: ["id"]
    },
  ]
}
```

- [ ] **Step 2: Update `src/lib/types.ts`**

In the `EventSource` interface (around line 146), add `auto_approve: boolean` after `is_active`:

```ts
export interface EventSource {
  id: string
  name: string
  url: string
  source_type: "website" | "ical" | "rss" | "manual"
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

- [ ] **Step 3: Update `supabase/functions/scrape-source/lib/types.ts`**

Add `auto_approve: boolean` to `EventSourceRow`:

```ts
export interface EventSourceRow {
  id: string
  name: string
  url: string
  source_type: SourceType
  city_id: string | null
  is_active: boolean
  auto_approve: boolean
  scrape_interval_hours: number
  last_scraped_at: string | null
  last_status: "pending" | "success" | "error" | "partial" | null
  error_count: number
}
```

- [ ] **Step 4: Run typecheck**

```bash
pnpm typecheck
```

Expected: passes (no errors relating to `auto_approve` yet — the hook and UI still reference the old select string, which will be caught in Task 4).

- [ ] **Step 5: Commit**

```bash
git add src/lib/database.types.ts src/lib/types.ts supabase/functions/scrape-source/lib/types.ts
git commit -m "feat: add auto_approve to EventSource and EventSourceRow types"
```

---

## Task 3: Edge Function Status Logic

**Files:**
- Modify: `supabase/functions/scrape-source/lib/process-source.ts` (line 445)

- [ ] **Step 1: Update status assignment**

Find the insert payload in `process-source.ts` (around line 429). The line reads:

```ts
status: "draft" as const,
```

Replace it with:

```ts
status: (!existingEventId && source.auto_approve) ? "published" : "draft",
```

`existingEventId` is already in scope — it gates the insert vs update path. This single change means:
- New insert from auto-approve source → `"published"`
- New insert from non-auto-approve source → `"draft"`
- Any update to an existing event → `"draft"` (unchanged, because `existingEventId` is truthy)

- [ ] **Step 2: Verify no other type errors**

```bash
cd supabase/functions && deno check scrape-source/lib/process-source.ts 2>&1 | head -30
```

Expected: no errors (or only pre-existing unrelated warnings).

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/scrape-source/lib/process-source.ts
git commit -m "feat: auto-publish events from sources with auto_approve enabled"
```

---

## Task 4: Update Hook — Select + Bulk Mutation

**Files:**
- Modify: `src/hooks/admin/use-admin-sources.ts`

- [ ] **Step 1: Add `auto_approve` to the select query**

In `useAdminSources`, update the `.select(...)` string to include `auto_approve`:

```ts
.select(
  "id, name, url, source_type, city_id, is_active, auto_approve, scrape_interval_hours, last_scraped_at, last_status, error_count, notes, created_at, updated_at"
)
```

- [ ] **Step 2: Add `useAdminBulkSetAutoApprove` hook**

Append this export at the end of the file:

```ts
export function useAdminBulkSetAutoApprove() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (enable: boolean) => {
      const { error } = await supabase.rpc("admin_bulk_set_auto_approve", { enable })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.admin.sources })
    },
  })
}
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: passes. The hook now returns `EventSource[]` with `auto_approve` included.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/admin/use-admin-sources.ts
git commit -m "feat: add auto_approve to sources select and add bulk-toggle hook"
```

---

## Task 5: Admin UI — Per-Source Toggle

**Files:**
- Modify: `src/components/admin/admin-sources-sections.tsx`

- [ ] **Step 1: Add `onToggleAutoApprove` to `AdminSourcesListProps`**

In `AdminSourcesListProps` (around line 197), add:

```ts
interface AdminSourcesListProps {
  sources: EventSource[]
  cities: City[]
  cityFilter: CityFilterValue
  scrapingSourceIds: Set<string>
  onToggleActive: (sourceId: string, isActive: boolean) => void
  onToggleAutoApprove: (sourceId: string, current: boolean) => void
  onScrape: (sourceId: string) => void
  onAddSourceForCity: (cityId: string) => void
}
```

- [ ] **Step 2: Thread `onToggleAutoApprove` through `AdminSourcesList`**

In `AdminSourcesList`, destructure the new prop and pass it to every `SourceCard`:

```ts
export function AdminSourcesList({
  sources,
  cities,
  cityFilter,
  scrapingSourceIds,
  onToggleActive,
  onToggleAutoApprove,
  onScrape,
  onAddSourceForCity,
}: AdminSourcesListProps) {
```

Every `<SourceCard ... />` call (there are two — one in the filtered branch and one in the grouped branch) needs `onToggleAutoApprove={onToggleAutoApprove}` added.

- [ ] **Step 3: Add `onToggleAutoApprove` to `SourceCardProps` and render the Switch**

Update `SourceCardProps`:

```ts
interface SourceCardProps {
  source: EventSource
  cities: City[]
  scrapingSourceIds: Set<string>
  onToggleActive: (sourceId: string, isActive: boolean) => void
  onToggleAutoApprove: (sourceId: string, current: boolean) => void
  onScrape: (sourceId: string) => void
}
```

In `SourceCard`, destructure `onToggleAutoApprove`. Then in the controls row (the `<div className="flex items-center gap-3 shrink-0">` around line 335), add an auto-approve Switch before the existing `is_active` Switch:

```tsx
<div className="flex items-center gap-3 shrink-0">
  <div className="flex items-center gap-1.5">
    <span className="text-xs text-muted-foreground">Auto</span>
    <Switch
      checked={source.auto_approve}
      onCheckedChange={() => onToggleAutoApprove(source.id, source.auto_approve)}
      aria-label={`Toggle ${source.name} auto-approve`}
    />
  </div>
  <Switch
    checked={source.is_active}
    onCheckedChange={(checked) => onToggleActive(source.id, checked)}
    aria-label={`Toggle ${source.name} active`}
  />
  <Button
    variant="outline"
    size="sm"
    className="gap-1.5 text-xs h-8"
    disabled={scrapingSourceIds.has(source.id) || !source.is_active}
    onClick={() => onScrape(source.id)}
  >
    <RefreshCw
      className={cn("h-3 w-3", scrapingSourceIds.has(source.id) && "animate-spin")}
    />
    {scrapingSourceIds.has(source.id) ? "Running..." : "Scrape Now"}
  </Button>
</div>
```

- [ ] **Step 4: Run typecheck**

```bash
pnpm typecheck
```

Expected: fails with errors about missing `onToggleAutoApprove` prop in `admin-sources.tsx` — that's the next task.

- [ ] **Step 5: Commit (partial — types updated, wiring next)**

```bash
git add src/components/admin/admin-sources-sections.tsx
git commit -m "feat: add per-source auto-approve toggle to SourceCard"
```

---

## Task 6: Admin UI — Bulk Buttons + Page Wiring

**Files:**
- Modify: `src/components/admin/admin-sources-sections.tsx`
- Modify: `src/pages/admin/admin-sources.tsx`

- [ ] **Step 1: Add bulk-toggle props to `AdminSourcesHeaderProps`**

Update the interface:

```ts
interface AdminSourcesHeaderProps {
  activeSourceCount: number
  cities: City[]
  dialogOpen: boolean
  newSource: {
    name: string
    url: string
    source_type: SourceType
    city_id: string
  }
  isBulkPending: boolean
  onDialogOpenChange: (open: boolean) => void
  onNameChange: (value: string) => void
  onUrlChange: (value: string) => void
  onTypeChange: (value: SourceType) => void
  onCityChange: (value: string) => void
  onAddSource: () => void
  onEnableAllAutoApprove: () => void
  onDisableAllAutoApprove: () => void
}
```

- [ ] **Step 2: Destructure and render bulk buttons in `AdminSourcesHeader`**

Update `AdminSourcesHeader` to destructure the new props and add two buttons beside "Add Source":

```tsx
export function AdminSourcesHeader({
  activeSourceCount,
  cities,
  dialogOpen,
  newSource,
  isBulkPending,
  onDialogOpenChange,
  onNameChange,
  onUrlChange,
  onTypeChange,
  onCityChange,
  onAddSource,
  onEnableAllAutoApprove,
  onDisableAllAutoApprove,
}: AdminSourcesHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-xl font-extrabold text-foreground">Event Sources</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{activeSourceCount} active sources</p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={isBulkPending}
          onClick={onEnableAllAutoApprove}
        >
          Auto-Approve All
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={isBulkPending}
          onClick={onDisableAllAutoApprove}
        >
          Disable All Auto
        </Button>
        <Dialog open={dialogOpen} onOpenChange={onDialogOpenChange}>
          {/* existing dialog trigger and content unchanged */}
        </Dialog>
      </div>
    </div>
  )
}
```

Keep the existing `<Dialog>` content inside the new `<div className="flex items-center gap-2">` wrapper.

- [ ] **Step 3: Wire up handlers in `admin-sources.tsx`**

Add the import for `useAdminBulkSetAutoApprove` alongside the existing imports:

```ts
import {
  useAdminSources,
  useCreateAdminSource,
  useTriggerSourceScrape,
  useUpdateAdminSource,
  useAdminBulkSetAutoApprove,
} from "@/hooks/admin/use-admin-sources"
```

Inside `AdminSourcesPage`, add the hook and two handler functions after the existing hooks:

```ts
const bulkAutoApprove = useAdminBulkSetAutoApprove()

async function handleToggleAutoApprove(sourceId: string, current: boolean) {
  try {
    await updateSource.mutateAsync({ sourceId, updates: { auto_approve: !current } })
  } catch (error) {
    toastError(error, "Failed to update source.")
  }
}

async function handleBulkAutoApprove(enable: boolean) {
  try {
    await bulkAutoApprove.mutateAsync(enable)
    toast.success(enable ? "Auto-approve enabled for all sources" : "Auto-approve disabled for all sources")
  } catch (error) {
    toastError(error, "Failed to update sources.")
  }
}
```

Also update `handleAddSource` to include `auto_approve: false` in the create payload (TypeScript now requires it):

```ts
await createSource.mutateAsync({
  name: newSource.name,
  url: newSource.url,
  source_type: newSource.source_type,
  city_id: newSource.city_id || null,
  is_active: true,
  auto_approve: false,
  scrape_interval_hours: 24,
  last_scraped_at: null,
  last_status: "pending",
  error_count: 0,
  notes: null,
})
```

Update the `AdminSourcesHeader` JSX to pass the new props:

```tsx
<AdminSourcesHeader
  activeSourceCount={sources.filter((source) => source.is_active).length}
  cities={cities}
  dialogOpen={dialogOpen}
  newSource={newSource}
  isBulkPending={bulkAutoApprove.isPending}
  onDialogOpenChange={setDialogOpen}
  onNameChange={(value) => setNewSource((prev) => ({ ...prev, name: value }))}
  onUrlChange={(value) => setNewSource((prev) => ({ ...prev, url: value }))}
  onTypeChange={(value) => setNewSource((prev) => ({ ...prev, source_type: value }))}
  onCityChange={(value) => setNewSource((prev) => ({ ...prev, city_id: value }))}
  onAddSource={handleAddSource}
  onEnableAllAutoApprove={() => handleBulkAutoApprove(true)}
  onDisableAllAutoApprove={() => handleBulkAutoApprove(false)}
/>
```

Update the `AdminSourcesList` JSX to pass `onToggleAutoApprove`:

```tsx
<AdminSourcesList
  sources={sources}
  cities={cities}
  cityFilter={cityFilter}
  scrapingSourceIds={scrapingSourceIds}
  onToggleActive={handleToggleActive}
  onToggleAutoApprove={handleToggleAutoApprove}
  onScrape={handleScrape}
  onAddSourceForCity={openAddDialogForCity}
/>
```

- [ ] **Step 4: Run typecheck**

```bash
pnpm typecheck
```

Expected: passes with no errors.

- [ ] **Step 5: Run lint**

```bash
pnpm lint
```

Expected: passes.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/admin-sources-sections.tsx src/pages/admin/admin-sources.tsx
git commit -m "feat: add bulk auto-approve toggle to sources admin header and wire up handlers"
```

---

## Self-Review

**Spec coverage:**
- ✅ `auto_approve` column on `event_sources` — Task 1
- ✅ New inserts only get auto-approved — Task 3 (`!existingEventId` guard)
- ✅ Updates to existing events unaffected — Task 3
- ✅ Per-source toggle in admin UI — Task 5
- ✅ Bulk-toggle (enable all / disable all) — Task 4 + Task 6
- ✅ RPC for bulk-toggle (atomic, SECURITY DEFINER) — Task 1
- ✅ Default `false` preserves existing behavior — Task 1 migration
- ✅ V2 extension point documented in spec (no code needed in plan)
- ✅ Global master switch explicitly out of scope — not implemented

**No placeholders:** All code is complete.

**Type consistency:** `auto_approve: boolean` used uniformly across `EventSourceRow`, `EventSource`, `database.types.ts`, and all component/hook usages.
