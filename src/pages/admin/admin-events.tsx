import { useState } from "react"
import { Check, X, Eye, Tag, Search } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TagBadge, AgeRangeBadge } from "@/components/tag-badge"
import { MOCK_EVENTS, MOCK_TAGS } from "@/lib/mock-data"
import { toast } from "sonner"

type EventStatus = "draft" | "published" | "rejected" | "archived"

export function AdminEventsPage() {
  const [events, setEvents] = useState(MOCK_EVENTS.map(e => ({ ...e, status: e.status as EventStatus })))
  const [keyword, setKeyword] = useState("")
  const [statusFilter, setStatusFilter] = useState<EventStatus | "all">("all")
  const [selectedEvent, setSelectedEvent] = useState<typeof events[0] | null>(null)

  const filtered = events.filter(e => {
    if (keyword && !e.title.toLowerCase().includes(keyword.toLowerCase())) return false
    if (statusFilter !== "all" && e.status !== statusFilter) return false
    return true
  })

  function updateStatus(id: string, newStatus: EventStatus) {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, status: newStatus } : e))
    toast.success(`Event ${newStatus}`)
    setSelectedEvent(null)
  }

  const statusConfig: Record<EventStatus, { label: string; color: string }> = {
    draft: { label: "Draft", color: "bg-muted text-muted-foreground" },
    published: { label: "Published", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    rejected: { label: "Rejected", color: "bg-destructive/10 text-destructive" },
    archived: { label: "Archived", color: "bg-muted/50 text-muted-foreground" },
  }

  const counts = events.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-foreground">Events</h1>
        <div className="flex gap-3 mt-2 flex-wrap">
          {(["all", "draft", "published", "rejected"] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors",
                statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"
              )}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
              {s !== "all" && counts[s] ? <span className="ml-1">({counts[s]})</span> : s === "all" ? <span className="ml-1">({events.length})</span> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            placeholder="Search events..."
            className="pl-9"
          />
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map(event => {
          const imageUrl = event.images?.[0] || `https://picsum.photos/seed/${event.id}/200/200`
          const status = statusConfig[event.status]
          return (
            <Card key={event.id} className="border-border/60">
              <CardContent className="p-4">
                <div className="flex gap-3 items-start">
                  <div className="h-14 w-14 rounded-xl overflow-hidden shrink-0 bg-muted">
                    <img src={imageUrl} alt={event.title} className="h-full w-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm text-foreground leading-tight flex-1">{event.title}</h3>
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", status.color)}>
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
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <AgeRangeBadge ageMin={event.age_min} ageMax={event.age_max} />
                      {event.tags?.slice(0, 2).map(et => (
                        <TagBadge key={et.tag_id} tag={et.tag} />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setSelectedEvent(event)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {event.status === "draft" && (
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
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        {selectedEvent && (
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Review Event</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <img
                src={selectedEvent.images?.[0] || `https://picsum.photos/seed/${selectedEvent.id}/600/300`}
                alt={selectedEvent.title}
                className="w-full h-40 object-cover rounded-xl"
              />
              <div>
                <h3 className="font-bold text-lg">{selectedEvent.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{selectedEvent.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Date:</span> <span className="font-medium">{format(new Date(selectedEvent.start_datetime), "MMM d, h:mm a")}</span></div>
                <div><span className="text-muted-foreground">Venue:</span> <span className="font-medium">{selectedEvent.venue_name}</span></div>
                <div><span className="text-muted-foreground">Price:</span> <span className="font-medium">{selectedEvent.is_free ? "Free" : `$${selectedEvent.price}`}</span></div>
                <div><span className="text-muted-foreground">AI confidence:</span> <span className="font-medium">{Math.round((selectedEvent.ai_confidence ?? 0) * 100)}%</span></div>
              </div>
              <div>
                <p className="text-sm font-semibold mb-2">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedEvent.tags?.map(et => (
                    <TagBadge key={et.tag_id} tag={et.tag} />
                  ))}
                  {MOCK_TAGS.slice(0, 3).map(tag => (
                    <button
                      key={tag.id}
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    >
                      + {tag.name}
                    </button>
                  ))}
                </div>
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
