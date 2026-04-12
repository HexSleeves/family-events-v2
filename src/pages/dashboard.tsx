import { useState } from "react"
import { Link } from "react-router-dom"
import { format } from "date-fns"
import { MapPin, Clock, Lightbulb, Calendar, Sparkles, TrendingUp, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { EventCard } from "@/components/event-card"
import { useAuth } from "@/contexts/auth-context"
import { MOCK_EVENTS } from "@/lib/mock-data"

export function DashboardPage() {
  const { user, profile } = useAuth()
  const [favorited, setFavorited] = useState<Set<string>>(
    new Set(MOCK_EVENTS.filter((e) => e.is_favorited).map((e) => e.id))
  )

  function handleFavoriteToggle(eventId: string, newState: boolean) {
    setFavorited((prev) => {
      const next = new Set(prev)
      if (newState) next.add(eventId)
      else next.delete(eventId)
      return next
    })
  }

  const featuredEvents = MOCK_EVENTS.filter((e) => e.is_featured)
  const happeningSoon = MOCK_EVENTS.filter((e) => !e.is_featured).slice(0, 4)
  const recommended = MOCK_EVENTS.slice(0, 4)
  const savedEvents = MOCK_EVENTS.filter((e) => favorited.has(e.id)).slice(0, 3)
  const todayEvents = MOCK_EVENTS.filter((e) => {
    const d = new Date(e.start_datetime)
    const today = new Date()
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth()
  }).slice(0, 2)

  const greeting = profile?.display_name
    ? `Welcome back, ${profile.display_name.split(" ")[0]}!`
    : "Today's adventures"

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">
            Dashboard
          </p>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight text-balance">
            {greeting}
          </h1>
          {profile?.child_name && (
            <p className="text-muted-foreground mt-1 text-sm">
              You have adventures planned for {profile.child_name} this week.
            </p>
          )}
        </div>
        {user && (
          <Avatar className="h-11 w-11 border-2 border-primary/20">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground font-bold">
              {profile?.display_name?.charAt(0)?.toUpperCase() ?? "U"}
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* Today's Events / Upcoming Bookings */}
      {todayEvents.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Upcoming Today
            </h2>
            <Button variant="ghost" size="sm" className="text-primary gap-1" asChild>
              <Link to="/calendar">
                View Calendar <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </div>

          <div className="space-y-3">
            {todayEvents.map((event) => {
              const isFirst = todayEvents.indexOf(event) === 0
              return (
                <Link key={event.id} to={`/events/${event.id}`}>
                  <Card
                    className={cn(
                      "overflow-hidden border-border/60 hover:shadow-md transition-all",
                      isFirst && "border-primary/30 bg-gradient-to-r from-primary/5 to-transparent"
                    )}
                  >
                    <CardContent className="p-4">
                      {isFirst && (
                        <div className="flex items-center gap-2 mb-3">
                          <Badge className="bg-primary text-primary-foreground text-xs uppercase tracking-wide">
                            Today · {format(new Date(event.start_datetime), "h:mm a")}
                          </Badge>
                        </div>
                      )}
                      <div className="flex gap-4">
                        <div className="h-20 w-20 rounded-xl overflow-hidden shrink-0 bg-muted">
                          <img
                            src={
                              event.images?.[0] || `https://picsum.photos/seed/${event.id}/200/200`
                            }
                            alt={event.title}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-base text-foreground leading-tight">
                            {event.title}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-1 text-muted-foreground text-xs">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate">{event.venue_name}</span>
                          </div>
                          <div className="mt-2">
                            {isFirst ? (
                              <Button size="sm" className="h-7 text-xs gap-1.5">
                                View Details
                              </Button>
                            ) : (
                              <Button variant="outline" size="sm" className="h-7 text-xs">
                                Details
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Featured Events Carousel */}
      {featuredEvents.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Featured Events
            </h2>
            <Button variant="ghost" size="sm" className="text-primary gap-1" asChild>
              <Link to="/explore">
                See all <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </div>

          <Carousel className="w-full">
            <CarouselContent className="-ml-3">
              {featuredEvents.map((event) => (
                <CarouselItem key={event.id} className="pl-3 basis-[85%] sm:basis-1/2 lg:basis-1/3">
                  <EventCard
                    event={{ ...event, is_favorited: favorited.has(event.id) }}
                    variant="featured"
                    onFavoriteToggle={handleFavoriteToggle}
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden sm:flex" />
            <CarouselNext className="hidden sm:flex" />
          </Carousel>
        </section>
      )}

      {/* Recommended / Personalized */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            {user && profile?.child_name
              ? `Recommended for ${profile.child_name}`
              : "Happening Near You"}
          </h2>
          <Button variant="ghost" size="sm" className="text-primary gap-1" asChild>
            <Link to="/explore">
              See all <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>

        <Carousel className="w-full">
          <CarouselContent className="-ml-3">
            {recommended.map((event) => (
              <CarouselItem key={event.id} className="pl-3 basis-[85%] sm:basis-1/2 lg:basis-1/3">
                <EventCard
                  event={{ ...event, is_favorited: favorited.has(event.id) }}
                  variant="default"
                  onFavoriteToggle={handleFavoriteToggle}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="hidden sm:flex" />
          <CarouselNext className="hidden sm:flex" />
        </Carousel>
      </section>

      {/* Happening Soon grid */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Happening Soon
          </h2>
          <Button variant="ghost" size="sm" className="text-primary gap-1" asChild>
            <Link to="/explore">
              See all <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {happeningSoon.map((event) => (
            <EventCard
              key={event.id}
              event={{ ...event, is_favorited: favorited.has(event.id) }}
              variant="list"
              onFavoriteToggle={handleFavoriteToggle}
            />
          ))}
        </div>
      </section>

      {/* Saved Ideas */}
      {savedEvents.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">Saved Ideas</h2>
            <Button variant="ghost" size="sm" className="text-primary gap-1" asChild>
              <Link to="/saved">
                View all saved <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </div>

          <Card className="border-border/60">
            <CardContent className="p-4 divide-y divide-border/50">
              {savedEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={{ ...event, is_favorited: true }}
                  variant="compact"
                  onFavoriteToggle={handleFavoriteToggle}
                />
              ))}
            </CardContent>
          </Card>

          <Button
            variant="outline"
            className="w-full mt-3 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            asChild
          >
            <Link to="/saved">Explore All Saved ({favorited.size})</Link>
          </Button>
        </section>
      )}

      {/* Parent Pulse Banner */}
      <div className="rounded-2xl bg-primary p-4 flex items-start gap-3">
        <div className="h-8 w-8 rounded-xl bg-primary-foreground/20 flex items-center justify-center shrink-0">
          <Lightbulb className="h-4 w-4 text-primary-foreground" />
        </div>
        <div>
          <p className="text-primary-foreground font-semibold text-sm">Parent Pulse</p>
          <p className="text-primary-foreground/80 text-xs mt-0.5 leading-relaxed">
            Weekend sensory play sessions are usually less crowded after 11:15 AM. Early arrival
            recommended for most popular events!
          </p>
        </div>
      </div>

      {/* CTA for guests */}
      {!user && (
        <div className="rounded-2xl border border-border/60 bg-family-warm p-6 text-center">
          <h3 className="text-xl font-bold text-family-warm-foreground mb-2">
            Never miss a playdate.
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Join 5,000+ local parents getting a weekly curated list of weekend toddler events.
          </p>
          <Button className="w-full sm:w-auto" asChild>
            <Link to="/sign-up">Get Started Free</Link>
          </Button>
        </div>
      )}
    </div>
  )
}
