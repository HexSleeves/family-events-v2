import { useState } from "react"
import { Link } from "react-router-dom"
import { format } from "date-fns"
import { Bookmark, Clock, Star, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { StarRating } from "@/components/star-rating"
import { AgeRangeBadge, TagBadge } from "@/components/tag-badge"
import { useAuth } from "@/contexts/auth-context"
import { MOCK_EVENTS } from "@/lib/mock-data"
import { toast } from "sonner"

export function MyEventsPage() {
  const { user } = useAuth()
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [savedIds, setSavedIds] = useState<Set<string>>(
    new Set(MOCK_EVENTS.filter(e => e.is_favorited || e.is_in_calendar).map(e => e.id))
  )

  const now = new Date()
  const upcomingEvents = MOCK_EVENTS.filter(e =>
    savedIds.has(e.id) && new Date(e.start_datetime) >= now
  )
  const pastEvents = MOCK_EVENTS.filter(e =>
    savedIds.has(e.id) && new Date(e.start_datetime) < now
  )
  const allSaved = MOCK_EVENTS.filter(e => savedIds.has(e.id))

  function handleRemove(eventId: string) {
    setSavedIds(prev => {
      const next = new Set(prev)
      next.delete(eventId)
      return next
    })
    toast("Removed from saved events")
  }

  if (!user) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center">
        <Bookmark className="h-16 w-16 text-muted-foreground/30 mx-auto mb-6" />
        <h1 className="text-2xl font-extrabold text-foreground mb-2">My Events</h1>
        <p className="text-muted-foreground mb-6">Sign in to save and manage your family events.</p>
        <div className="flex gap-3 justify-center">
          <Button asChild>
            <Link to="/sign-in">Sign In</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/sign-up">Create Account</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground">My Events</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {allSaved.length} saved event{allSaved.length !== 1 ? "s" : ""}
        </p>
      </div>

      <Tabs defaultValue="upcoming">
        <TabsList className="grid w-full grid-cols-3 h-10">
          <TabsTrigger value="upcoming" className="text-xs sm:text-sm">
            Upcoming
            {upcomingEvents.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[10px]">
                {upcomingEvents.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="saved" className="text-xs sm:text-sm">
            Saved Ideas
            {allSaved.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[10px]">
                {allSaved.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="past" className="text-xs sm:text-sm">
            Past
          </TabsTrigger>
        </TabsList>

        {/* Upcoming */}
        <TabsContent value="upcoming" className="mt-4 space-y-3">
          {upcomingEvents.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No upcoming events"
              description="Browse events and add them to your calendar."
              cta="Explore Events"
              ctaHref="/explore"
            />
          ) : (
            upcomingEvents.map(event => (
              <EventRow
                key={event.id}
                event={event}
                onRemove={handleRemove}
                variant="upcoming"
              />
            ))
          )}
        </TabsContent>

        {/* Saved Ideas */}
        <TabsContent value="saved" className="mt-4 space-y-3">
          {allSaved.length === 0 ? (
            <EmptyState
              icon={Bookmark}
              title="No saved events yet"
              description="Tap the heart on any event to save it here."
              cta="Find Events"
              ctaHref="/explore"
            />
          ) : (
            allSaved.map(event => (
              <EventRow
                key={event.id}
                event={event}
                onRemove={handleRemove}
                variant="saved"
              />
            ))
          )}
        </TabsContent>

        {/* Past */}
        <TabsContent value="past" className="mt-4 space-y-3">
          {pastEvents.length === 0 ? (
            <EmptyState
              icon={Star}
              title="No past events"
              description="Events you've attended will appear here."
              cta="Find Events"
              ctaHref="/explore"
            />
          ) : (
            pastEvents.map(event => (
              <EventRow
                key={event.id}
                event={event}
                onRemove={handleRemove}
                rating={ratings[event.id]}
                onRate={score => {
                  setRatings(prev => ({ ...prev, [event.id]: score }))
                  toast.success("Rating saved!")
                }}
                variant="past"
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function EventRow({
  event,
  onRemove,
  rating,
  onRate,
  variant,
}: {
  event: (typeof MOCK_EVENTS)[0]
  onRemove: (id: string) => void
  rating?: number
  onRate?: (score: number) => void
  variant: "upcoming" | "saved" | "past"
}) {
  const imageUrl = event.images?.[0] || `https://picsum.photos/seed/${event.id}/200/200`
  const startDate = new Date(event.start_datetime)

  return (
    <Card className="border-border/60 hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        <div className="flex gap-4">
          <Link to={`/events/${event.id}`} className="shrink-0">
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl overflow-hidden bg-muted">
              <img src={imageUrl} alt={event.title} className="h-full w-full object-cover" />
            </div>
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <Link to={`/events/${event.id}`} className="min-w-0">
                <h3 className="font-bold text-sm text-foreground leading-tight line-clamp-2">{event.title}</h3>
              </Link>
              <button
                onClick={() => onRemove(event.id)}
                className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                aria-label="Remove"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{format(startDate, "EEE, MMM d · h:mm a")}</span>
            </div>

            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={event.is_free ? "text-xs font-bold text-green-600" : "text-xs font-bold text-primary"}>
                {event.is_free ? "Free" : `$${event.price}`}
              </span>
              <AgeRangeBadge ageMin={event.age_min} ageMax={event.age_max} />
              {event.tags?.[0] && <TagBadge tag={event.tags[0].tag} />}
            </div>

            {variant === "past" && onRate && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Rate:</span>
                <StarRating
                  value={rating ?? 0}
                  onChange={onRate}
                  size="sm"
                />
              </div>
            )}

            {variant === "upcoming" && (
              <div className="mt-2 flex gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                  <Link to={`/events/${event.id}`}>View Details</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyState({
  icon: Icon,
  title,
  description,
  cta,
  ctaHref,
}: {
  icon: React.ElementType
  title: string
  description: string
  cta: string
  ctaHref: string
}) {
  return (
    <div className="py-16 text-center">
      <Icon className="h-14 w-14 text-muted-foreground/25 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm mb-5">{description}</p>
      <Button asChild>
        <Link to={ctaHref}>{cta}</Link>
      </Button>
    </div>
  )
}
