import { useMemo, useState } from "react"
import type { Event } from "@/lib/types"
import { humanizeSupabaseError } from "@/lib/humanize-supabase-error"
import {
  AdminEventReviewDialog,
  AdminEventsBulkBar,
  AdminEventsList,
  AdminEventsToolbar,
  AdminEventStatusFilterBar,
} from "@/components/admin/admin-events-sections"
import { AdminCityFilterBar } from "@/components/admin/admin-city-filter-bar"
import {
  useAdminEventFacets,
  useAdminEvents,
  useBatchUpdateAdminEventStatus,
  useUpdateAdminEventStatus,
} from "@/hooks/admin/use-admin-events"
import {
  useAdminEventAiTrace,
  useUpdateAdminEventTags,
} from "@/hooks/admin/use-admin-event-ai-trace"
import { useAdminCities } from "@/hooks/admin/use-admin-cities"
import { useCityFilter } from "@/hooks/admin/use-city-filter"
import { UNASSIGNED_CITY_KEY } from "@/lib/group-by-city"
import { useTags } from "@/hooks/use-tags"
import { toast } from "sonner"

type EventStatusFilter = Event["status"] | "all"

export function AdminEventsPage() {
  const [keyword, setKeyword] = useState("")
  const [statusFilter, setStatusFilter] = useState<EventStatusFilter>("all")
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [editingTagIds, setEditingTagIds] = useState<string[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const { value: cityFilter, setValue: setCityFilter } = useCityFilter()

  const { data: events = [] } = useAdminEvents(keyword, statusFilter, cityFilter)
  const { data: facets = [] } = useAdminEventFacets(keyword)
  const { data: cities = [] } = useAdminCities()
  const { data: selectedEventTrace, isLoading: isTraceLoading } =
    useAdminEventAiTrace(selectedEventId)
  const { data: allTags = [] } = useTags()
  const updateStatusMutation = useUpdateAdminEventStatus()
  const batchUpdateStatusMutation = useBatchUpdateAdminEventStatus()
  const updateTagsMutation = useUpdateAdminEventTags()

  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null
  const tagNameById = new Map(allTags.map((tag) => [tag.id, tag.name]))
  const tagNameBySlug = new Map(allTags.map((tag) => [tag.slug, tag.name]))
  const draftEvents = events.filter((event) => event.status === "draft")
  const selectedDraftIds = [...selectedIds].filter((id) =>
    draftEvents.some((event) => event.id === id)
  )
  const allDraftsSelected =
    draftEvents.length > 0 && draftEvents.every((event) => selectedIds.has(event.id))

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const row of facets) {
      const matchesCity =
        cityFilter === "all"
          ? true
          : cityFilter === UNASSIGNED_CITY_KEY
            ? row.city_id === null
            : row.city_id === cityFilter
      if (!matchesCity) continue
      counts[row.status] = (counts[row.status] ?? 0) + 1
    }
    return counts
  }, [facets, cityFilter])

  const statusTotal = useMemo(
    () => Object.values(statusCounts).reduce((sum, n) => sum + n, 0),
    [statusCounts]
  )

  const cityCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const row of facets) {
      if (statusFilter !== "all" && row.status !== statusFilter) continue
      const key = row.city_id ?? UNASSIGNED_CITY_KEY
      counts[key] = (counts[key] ?? 0) + 1
    }
    return counts
  }, [facets, statusFilter])

  const cityTotal = useMemo(
    () => Object.values(cityCounts).reduce((sum, n) => sum + n, 0),
    [cityCounts]
  )

  const statusConfig: Record<Event["status"], { label: string; color: string }> = {
    draft: { label: "Draft", color: "bg-muted text-muted-foreground" },
    published: {
      label: "Published",
      color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    },
    rejected: { label: "Rejected", color: "bg-destructive/10 text-destructive" },
    archived: { label: "Archived", color: "bg-muted/50 text-muted-foreground" },
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function handleStatusFilterChange(status: EventStatusFilter) {
    setStatusFilter(status)
    setSelectedIds(new Set())
  }

  function toggleSelectAll() {
    setSelectedIds(allDraftsSelected ? new Set() : new Set(draftEvents.map((event) => event.id)))
  }

  async function batchUpdateStatus(newStatus: Event["status"]) {
    if (selectedDraftIds.length === 0) return
    try {
      const { count } = await batchUpdateStatusMutation.mutateAsync({
        eventIds: selectedDraftIds,
        status: newStatus,
      })
      toast.success(`${count} event${count === 1 ? "" : "s"} ${newStatus}`)
      setSelectedIds(new Set())
    } catch (error) {
      toast.error(humanizeSupabaseError(error, "Bulk update failed."))
    }
  }

  async function updateStatus(id: string, newStatus: Event["status"]) {
    try {
      await updateStatusMutation.mutateAsync({ eventId: id, status: newStatus })
      toast.success(`Event ${newStatus}`)
      setSelectedEventId(null)
    } catch (error) {
      toast.error(humanizeSupabaseError(error, "Failed to update event status."))
    }
  }

  async function saveTagOverrides() {
    if (!selectedEvent) return
    try {
      await updateTagsMutation.mutateAsync({ eventId: selectedEvent.id, tagIds: editingTagIds })
      toast.success("Tags updated")
    } catch (error) {
      toast.error(humanizeSupabaseError(error, "Failed to update tags."))
    }
  }

  return (
    <div className="space-y-6">
      <AdminEventStatusFilterBar
        statusFilter={statusFilter}
        counts={statusCounts}
        total={statusTotal}
        onChange={handleStatusFilterChange}
      />
      <AdminCityFilterBar
        cities={cities}
        counts={cityCounts}
        total={cityTotal}
        value={cityFilter}
        onChange={setCityFilter}
      />
      <AdminEventsToolbar
        keyword={keyword}
        onKeywordChange={setKeyword}
        draftCount={draftEvents.length}
        allDraftsSelected={allDraftsSelected}
        onToggleSelectAll={toggleSelectAll}
      />
      <AdminEventsBulkBar
        selectedCount={selectedDraftIds.length}
        isPending={batchUpdateStatusMutation.isPending}
        onPublish={() => batchUpdateStatus("published")}
        onReject={() => batchUpdateStatus("rejected")}
        onClear={() => setSelectedIds(new Set())}
      />
      <AdminEventsList
        events={events}
        selectedIds={selectedIds}
        statusConfig={statusConfig}
        cities={cities}
        cityFilter={cityFilter}
        onToggleSelect={toggleSelect}
        onOpenReview={(event) => {
          setSelectedEventId(event.id)
          setEditingTagIds((event.tags ?? []).map((tag) => tag.tag_id))
        }}
        onUpdateStatus={updateStatus}
      />
      <AdminEventReviewDialog
        event={selectedEvent}
        open={Boolean(selectedEvent)}
        onOpenChange={(open) => {
          if (!open) setSelectedEventId(null)
        }}
        editingTagIds={editingTagIds}
        allTags={allTags}
        tagNameById={tagNameById}
        tagNameBySlug={tagNameBySlug}
        onToggleTag={(tagId) =>
          setEditingTagIds((current) =>
            current.includes(tagId)
              ? current.filter((currentId) => currentId !== tagId)
              : [...current, tagId]
          )
        }
        onSaveTags={saveTagOverrides}
        selectedEventTrace={selectedEventTrace ?? null}
        isTraceLoading={isTraceLoading}
        onPublish={() => selectedEvent && updateStatus(selectedEvent.id, "published")}
        onReject={() => selectedEvent && updateStatus(selectedEvent.id, "rejected")}
      />
    </div>
  )
}
