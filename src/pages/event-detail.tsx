import { useState } from "react"
import { useParams, Link } from "react-router-dom"
import { format } from "date-fns"
import { ArrowLeft, MapPin, Clock, Users, Star, CalendarPlus, Share2, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { TagBadge, AgeRangeBadge } from "@/components/tag-badge"
import { FavoriteButton } from "@/components/favorite-button"
import { StarRating } from "@/components/star-rating"
import { useAuth } from "@/contexts/auth-context"
import { MOCK_EVENTS } from "@/lib/mock-data"
import { toast } from "sonner"

const MOCK_COMMENTS = [
  {
    id: "c1",
    user: "Maria T.",
    avatar: null,
    body: "Our 3-year-old absolutely loved it! The instructor was so patient and creative.",
    rating: 5,
    date: "2 days ago",
  },
  {
    id: "c2",
    user: "James P.",
    avatar: null,
    body: "Great way to spend a morning. Parking can be tricky so arrive early!",
    rating: 4,
    date: "1 week ago",
  },
]

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [attendees, setAttendees] = useState(1)
  const [userRating, setUserRating] = useState(0)
  const [comment, setComment] = useState("")
  const [isFavorited, setIsFavorited] = useState(false)
  const [isInCalendar, setIsInCalendar] = useState(false)
  const [submittingComment, setSubmittingComment] = useState(false)

  const event = MOCK_EVENTS.find((e) => e.id === id) ?? MOCK_EVENTS[0]
  const imageUrl = event.images?.[0] || `https://picsum.photos/seed/${event.id}/800/500`
  const startDate = new Date(event.start_datetime)

  function handleAddToCalendar() {
    if (!user) {
      toast("Sign in required", {
        description: "Create a free account to save events to your calendar.",
      })
      return
    }
    setIsInCalendar(!isInCalendar)
    toast.success(isInCalendar ? "Removed from calendar" : "Added to your calendar!")
  }

  async function handleSubmitComment() {
    if (!comment.trim()) return
    if (!user) {
      toast("Sign in to leave a comment")
      return
    }
    setSubmittingComment(true)
    await new Promise((r) => setTimeout(r, 600))
    setSubmittingComment(false)
    setComment("")
    toast.success("Comment posted!")
  }

  const infoItems = [
    {
      label: "Duration",
      value: event.end_datetime
        ? `${Math.round((new Date(event.end_datetime).getTime() - new Date(event.start_datetime).getTime()) / 60000)} mins`
        : "TBD",
      icon: Clock,
    },
    { label: "Price", value: event.is_free ? "Free" : `$${event.price}`, icon: Star },
    { label: "Capacity", value: "12 Spots", icon: Users },
    {
      label: "Rating",
      value: event.avg_rating ? `${event.avg_rating} (${event.rating_count})` : "No ratings",
      icon: Star,
    },
  ]

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back button */}
      <div className="sticky top-14 z-30 bg-background/90 backdrop-blur border-b border-border/40 px-4 py-2">
        <Button variant="ghost" size="sm" className="gap-2 -ml-2" asChild>
          <Link to="/explore">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      {/* Hero image */}
      <div className="relative">
        <img src={imageUrl} alt={event.title} className="w-full h-64 sm:h-80 object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        <div className="absolute top-4 right-4 flex gap-2">
          <FavoriteButton
            eventId={event.id}
            isFavorited={isFavorited}
            onToggle={(_, state) => setIsFavorited(state)}
            variant="overlay"
          />
          <button className="h-9 w-9 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-md">
            <Share2 className="h-4 w-4 text-foreground" />
          </button>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Title + metadata */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              {format(startDate, "EEEE MMMM")} Morning
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">{event.title}</h1>
          <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
            {event.description?.slice(0, 100)}
          </p>

          <div className="flex flex-wrap gap-2 mt-3">
            <AgeRangeBadge ageMin={event.age_min} ageMax={event.age_max} />
            {event.tags?.slice(0, 3).map((et) => (
              <TagBadge key={et.tag_id} tag={et.tag} />
            ))}
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-3">
          {infoItems.map((item) => (
            <Card key={item.label} className="border-border/60">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-sm font-bold text-foreground">{item.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* About */}
        <div>
          <h2 className="text-lg font-bold text-foreground mb-3">About the Experience</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{event.description}</p>

          {/* Parent tip */}
          <div className="mt-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 p-4 flex gap-3">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-0.5">
                Parent Tip
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-500 leading-relaxed">
                We recommend arriving 10 minutes early to let your toddler get comfortable with the
                space before the session begins!
              </p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Location */}
        <div>
          <h2 className="text-lg font-bold text-foreground mb-3">Location</h2>
          <div className="flex items-start gap-3 mb-3">
            <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">{event.venue_name}</p>
              <p className="text-sm text-muted-foreground">{event.address}</p>
            </div>
          </div>
          <div className="rounded-xl bg-muted/50 border border-border/60 h-36 flex items-center justify-center">
            <p className="text-muted-foreground text-sm">Map view</p>
          </div>
        </div>

        <Separator />

        {/* Book / Reserve */}
        <div>
          <h2 className="text-lg font-bold text-foreground mb-4">Reserve Your Spot</h2>
          <div className="space-y-3 mb-5">
            <div className="flex items-center justify-between py-3 border-b border-border/40">
              <span className="text-sm text-muted-foreground">Date</span>
              <span className="text-sm font-semibold">{format(startDate, "EEE, MMM d")}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-border/40">
              <span className="text-sm text-muted-foreground">Time</span>
              <span className="text-sm font-semibold">{format(startDate, "h:mm a")}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-muted-foreground">Attendees</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setAttendees(Math.max(1, attendees - 1))}
                  className="h-7 w-7 rounded-full border border-border flex items-center justify-center hover:bg-accent text-sm font-bold"
                >
                  −
                </button>
                <span className="text-sm font-bold w-4 text-center">{attendees}</span>
                <button
                  onClick={() => setAttendees(Math.min(8, attendees + 1))}
                  className="h-7 w-7 rounded-full border border-border flex items-center justify-center hover:bg-accent text-sm font-bold"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <Button className="w-full h-12 text-base font-bold" asChild>
            <a href={event.source_url || "#"} target="_blank" rel="noopener noreferrer">
              {event.is_free
                ? "Reserve Your Spot (Free)"
                : `Book Now · $${(event.price ?? 0) * attendees}`}
            </a>
          </Button>
          <Button
            variant="outline"
            className={cn(
              "w-full h-11 mt-3 gap-2",
              isInCalendar && "border-primary text-primary bg-primary/5"
            )}
            onClick={handleAddToCalendar}
          >
            <CalendarPlus className="h-4 w-4" />
            {isInCalendar ? "Added to Calendar" : "Add to Calendar"}
          </Button>

          <div className="flex items-center justify-center gap-1.5 mt-3">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
            <span className="text-xs text-muted-foreground">SECURE PARENTING PLATFORM</span>
          </div>
        </div>

        <Separator />

        {/* Ratings & Comments */}
        <div>
          <h2 className="text-lg font-bold text-foreground mb-4">Reviews</h2>

          {/* Submit rating */}
          {user && (
            <Card className="border-border/60 mb-4">
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-semibold">Leave a review</p>
                <StarRating value={userRating} onChange={setUserRating} size="lg" />
                <Textarea
                  placeholder="Share your experience..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  className="text-sm resize-none"
                />
                <Button
                  size="sm"
                  disabled={submittingComment || !comment.trim()}
                  onClick={handleSubmitComment}
                >
                  {submittingComment ? "Posting..." : "Post Review"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Existing comments */}
          <div className="space-y-4">
            {MOCK_COMMENTS.map((c) => (
              <div key={c.id} className="flex gap-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="text-xs bg-muted">{c.user.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{c.user}</span>
                    <StarRating value={c.rating} readonly size="sm" />
                    <span className="text-xs text-muted-foreground ml-auto">{c.date}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{c.body}</p>
                </div>
              </div>
            ))}
          </div>

          {!user && (
            <div className="mt-4 text-center">
              <p className="text-sm text-muted-foreground mb-2">Sign in to leave a review</p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/sign-in">Sign In</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
