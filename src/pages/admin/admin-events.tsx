import { useState } from "react"
import {
  Check,
  X,
  Eye,
  Tag,
  Search,
  CheckCheck,
  XCircle,
  Bot,
  Sparkles,
  AlertTriangle,
} from "lucide-react"
import { format } from "date-fns"
import { cn, formatEventPrice } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { TagBadge, AgeRangeBadge } from "@/components/tag-badge"
import {
  useAdminEventAiTrace,
  useAdminEvents,
  useBatchUpdateAdminEventStatus,
  useUpdateAdminEventStatus,
  useUpdateAdminEventTags,
} from "@/hooks/admin/use-admin-data"
import { useTags } from "@/hooks/use-tags"
import { toast } from "sonner"

type EventStatus = "draft" | "published" | "rejected" | "archived"

function formatProviderLabel(provider: "openai" | "keyword-fallback" | null | undefined) {
  if (provider === "openai") {
    return "OpenAI"
  }
  if (provider === "keyword-fallback") {
    return "Keyword fallback"
  }
  return "Unknown"
}

export function AdminEventsPage() {
  const [keyword, setKeyword] = useState("")
  const [statusFilter, setStatusFilter] = useState<EventStatus | "all">("all")
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [editingTagIds, setEditingTagIds] = useState<string[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const { data: events = [] } = useAdminEvents(keyword, statusFilter)
  const { data: selectedEventTrace, isLoading: isTraceLoading } = useAdminEventAiTrace(selectedEventId)
  const { data: allTags = [] } = useTags()
  const updateStatusMutation = useUpdateAdminEventStatus()
  const batchUpdateStatusMutation = useBatchUpdateAdminEventStatus()
  const updateTagsMutation = useUpdateAdminEventTags()

  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null
  const tagNameById = new Map(allTags.map((tag) => [tag.id, tag.name]))
  const tagNameBySlug = new Map(allTags.map((tag) => [tag.slug, tag.name]))

  const draftEvents = events.filter((e) => e.status === "draft")
  const selectedDraftIds = [...selectedIds].filter((id) => draftEvents.some((e) => e.id === id))
  const allDraftsSelected =
    draftEvents.length > 0 && draftEvents.every((e) => selectedIds.has(e.id))

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

  function toggleSelectAll() {
    if (allDraftsSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(draftEvents.map((e) => e.id)))
    }
  }

  async function batchUpdateStatus(newStatus: EventStatus) {
    if (selectedDraftIds.length === 0) return

    try {
      const { count } = await batchUpdateStatusMutation.mutateAsync({
        eventIds: selectedDraftIds,
        status: newStatus,
      })
      toast.success(`${count} event${count === 1 ? "" : "s"} ${newStatus}`)
      setSelectedIds(new Set())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bulk update failed.")
    }
  }

  async function updateStatus(id: string, newStatus: EventStatus) {
    try {
      await updateStatusMutation.mutateAsync({ eventId: id, status: newStatus })
      toast.success(`Event ${newStatus}`)
      setSelectedEventId(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update event status.")
    }
  }

  async function saveTagOverrides() {
    if (!selectedEvent) {
      return
    }

    try {
      await updateTagsMutation.mutateAsync({
        eventId: selectedEvent.id,
        tagIds: editingTagIds,
      })
      toast.success("Tags updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update tags.")
    }
  }

  const statusConfig: Record<EventStatus, { label: string; color: string }> = {
    draft: { label: "Draft", color: "bg-muted text-muted-foreground" },
    published: {
      label: "Published",
      color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    },
    rejected: { label: "Rejected", color: "bg-destructive/10 text-destructive" },
    archived: { label: "Archived", color: "bg-muted/50 text-muted-foreground" },
  }

  const counts = events.reduce(
    (acc, e) => {
      acc[e.status] = (acc[e.status] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-foreground">Events</h1>
        <div className="flex gap-3 mt-2 flex-wrap">
          {(["all", "draft", "published", "rejected"] as const).map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatusFilter(s)
                setSelectedIds(new Set())
              }}
              className={cn(
                "text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors",
                statusFilter === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-accent"
              )}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
              {s !== "all" && counts[s] ? (
                <span className="ml-1">({counts[s]})</span>
              ) : s === "all" ? (
                <span className="ml-1">({events.length})</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Search events..."
            className="pl-9"
          />
        </div>
        {draftEvents.length > 0 && (
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={toggleSelectAll}>
            <Checkbox
              checked={allDraftsSelected}
              className="h-3.5 w-3.5"
              onCheckedChange={toggleSelectAll}
            />
            {allDraftsSelected ? "Deselect all" : `Select all drafts (${draftEvents.length})`}
          </Button>
        )}
      </div>

      {/* Bulk action bar */}
      {selectedDraftIds.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
          <span className="text-sm font-medium">
            {selectedDraftIds.length} draft{selectedDraftIds.length === 1 ? "" : "s"} selected
          </span>
          <div className="flex gap-2 ml-auto">
            <Button
              size="sm"
              className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
              disabled={batchUpdateStatusMutation.isPending}
              onClick={() => batchUpdateStatus("published")}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Publish selected
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
              disabled={batchUpdateStatusMutation.isPending}
              onClick={() => batchUpdateStatus("rejected")}
            >
              <XCircle className="h-3.5 w-3.5" />
              Reject selected
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {events.map((event) => {
          const imageUrl = event.images?.[0] || `https://picsum.photos/seed/${event.id}/200/200`
          const status = statusConfig[event.status]
          const isDraft = event.status === "draft"
          const isSelected = selectedIds.has(event.id)
          return (
            <Card
              key={event.id}
              className={cn(
                "border-border/60 transition-colors",
                isSelected && "border-primary/50 bg-primary/5"
              )}
            >
              <CardContent className="p-4">
                <div className="flex gap-3 items-start">
                  {isDraft && (
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(event.id)}
                      className="mt-1 shrink-0"
                    />
                  )}
                  <div className="h-14 w-14 rounded-xl overflow-hidden shrink-0 bg-muted">
                    <img src={imageUrl} alt={event.title} className="h-full w-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm text-foreground leading-tight flex-1">
                        {event.title}
                      </h3>
                      <span
                        className={cn(
                          "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                          status.color
                        )}
                      >
                        {status.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span>{format(new Date(event.start_datetime), "MMM d, h:mm a")}</span>
                      <span>{event.venue_name}</span>
                      {event.ai_confidence !== null && (
                        <span className="flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          AI: {Math.round((event.ai_confidence ?? 0) * 100)}%
                        </span>
                      )}
                      {event.ai_tag_provider && (
                        <span className="flex items-center gap-1">
                          <Bot className="h-3 w-3" />
                          {formatProviderLabel(event.ai_tag_provider)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <AgeRangeBadge ageMin={event.age_min} ageMax={event.age_max} />
                      {event.tags?.slice(0, 2).map((et) => (
                        <TagBadge key={et.tag_id} tag={et.tag} />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setSelectedEventId(event.id)
                        setEditingTagIds((event.tags ?? []).map((tag) => tag.tag_id))
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {isDraft && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                          onClick={() => updateStatus(event.id, "published")}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => updateStatus(event.id, "rejected")}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {event.status === "published" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => updateStatus(event.id, "archived")}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Event review dialog */}
      <Dialog
        open={!!selectedEvent}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedEventId(null)
          }
        }}
      >
        {selectedEvent && (
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Review Event</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <img
                src={
                  selectedEvent.images?.[0] ||
                  `https://picsum.photos/seed/${selectedEvent.id}/600/300`
                }
                alt={selectedEvent.title}
                className="w-full h-40 object-cover rounded-xl"
              />
              <div>
                <h3 className="font-bold text-lg">{selectedEvent.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{selectedEvent.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Date:</span>{" "}
                  <span className="font-medium">
                    {format(new Date(selectedEvent.start_datetime), "MMM d, h:mm a")}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Venue:</span>{" "}
                  <span className="font-medium">{selectedEvent.venue_name ?? "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Price:</span>{" "}
                  <span className="font-medium">
                    {formatEventPrice(selectedEvent.price, selectedEvent.is_free)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">AI confidence:</span>{" "}
                  <span className="font-medium">
                    {Math.round((selectedEvent.ai_confidence ?? 0) * 100)}%
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold mb-2">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedEvent.tags?.map((et) => (
                    <TagBadge key={et.tag_id} tag={et.tag} />
                  ))}
                  {allTags.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => {
                        setEditingTagIds((current) =>
                          current.includes(tag.id)
                            ? current.filter((tagId) => tagId !== tag.id)
                            : [...current, tag.id]
                        )
                      }}
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border transition-colors",
                        editingTagIds.includes(tag.id)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary"
                      )}
                    >
                      {editingTagIds.includes(tag.id) ? "✓" : "+"} {tag.name}
                    </button>
                  ))}
                </div>
                <Button size="sm" variant="outline" className="mt-2" onClick={saveTagOverrides}>
                  Save Tag Overrides
                </Button>
              </div>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold">AI Tagging Details</p>
                </div>

                {isTraceLoading ? (
                  <div className="space-y-2 rounded-xl border border-border/60 p-4">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : selectedEventTrace ? (
                  <div className="space-y-4 rounded-xl border border-border/60 p-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="gap-1">
                        <Bot className="h-3 w-3" />
                        {formatProviderLabel(selectedEventTrace.provider)}
                      </Badge>
                      {selectedEventTrace.model ? (
                        <Badge variant="outline">Model: {selectedEventTrace.model}</Badge>
                      ) : null}
                      <Badge variant="outline">Status: {selectedEventTrace.status}</Badge>
                      <Badge variant="outline">
                        Run: {format(new Date(selectedEventTrace.created_at), "MMM d, h:mm a")}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Summary
                        </p>
                        <p className="mt-1 text-sm text-foreground">
                          {selectedEventTrace.reasoning_summary ?? "No explanation was recorded."}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Fallback reason
                        </p>
                        <p className="mt-1 text-sm text-foreground">
                          {selectedEventTrace.fallback_reason ?? "None"}
                        </p>
                      </div>
                    </div>

                    {selectedEventTrace.status !== "success" && selectedEventTrace.fallback_reason ? (
                      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{selectedEventTrace.fallback_reason}</span>
                      </div>
                    ) : null}

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          AI suggested tags
                        </p>
                        <div className="mt-2 space-y-2">
                          {selectedEventTrace.parsed_predicted_tags.length > 0 ? (
                            selectedEventTrace.parsed_predicted_tags.map((tag) => (
                              <div key={tag.slug} className="rounded-lg border border-border/60 p-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-medium">
                                    {tagNameBySlug.get(tag.slug) ?? tag.slug}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {Math.round(tag.confidence * 100)}%
                                  </span>
                                </div>
                                {tag.reason ? (
                                  <p className="mt-1 text-xs text-muted-foreground">{tag.reason}</p>
                                ) : null}
                                {tag.matched_keywords?.length ? (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Keywords: {tag.matched_keywords.join(", ")}
                                  </p>
                                ) : null}
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground">No AI tag suggestions recorded.</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Final admin tags
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {editingTagIds.length > 0 ? (
                            editingTagIds.map((tagId) => (
                              <Badge key={tagId} variant="outline">
                                {tagNameById.get(tagId) ?? tagId}
                              </Badge>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground">No final tags selected.</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Extracted fields
                        </p>
                        <div className="mt-2 space-y-1 text-sm">
                          <div>
                            Age: {selectedEventTrace.parsed_predicted_fields?.age_min ?? "—"}
                            {selectedEventTrace.parsed_predicted_fields?.age_max !== null &&
                            selectedEventTrace.parsed_predicted_fields?.age_max !== undefined
                              ? ` to ${selectedEventTrace.parsed_predicted_fields.age_max}`
                              : ""}
                          </div>
                          <div>
                            Price:{" "}
                            {formatEventPrice(
                              selectedEventTrace.parsed_predicted_fields?.price ?? null,
                              selectedEventTrace.parsed_predicted_fields?.is_free ?? false
                            )}
                          </div>
                          <div>
                            Venue: {selectedEventTrace.parsed_predicted_fields?.venue_name ?? "—"}
                          </div>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Classification input
                        </p>
                        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                          <p className="font-medium text-foreground">{selectedEventTrace.input_title}</p>
                          <p>{selectedEventTrace.input_description ?? "No description captured."}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                    No AI trace has been recorded for this event yet.
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  className="flex-1 gap-2"
                  onClick={() => updateStatus(selectedEvent.id, "published")}
                >
                  <Check className="h-4 w-4" />
                  Publish
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 gap-2 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => updateStatus(selectedEvent.id, "rejected")}
                >
                  <X className="h-4 w-4" />
                  Reject
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
