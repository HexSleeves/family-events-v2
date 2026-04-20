import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from "date-fns"
import { ChevronLeft, ChevronRight, CalendarDays, List, Bookmark } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { EventCard, EventCardSkeleton } from "@/components/event-card"
import { useAuth } from "@/contexts/auth-context"
import { useApp } from "@/contexts/app-context"
import { useEnrichedEvents } from "@/hooks/use-enriched-events"
import { useFavorites } from "@/hooks/use-favorites"
import { useCalendarEvents } from "@/hooks/use-calendar-events"

export function CalendarViewPage() {
  const { user } = useAuth()
  const { selectedCity } = useApp()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [view, setView] = useState<"month" | "week">("month")
  const [favoriteOverrides, setFavoriteOverrides] = useState<Record<string, boolean>>({})

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const firstDayOfWeek = monthStart.getDay()

  const {
    data: monthEvents = [],
    isLoading: isMonthEventsLoading,
    isError: isMonthEventsError,
  } = useEnrichedEvents({
    cityId: selectedCity?.id,
    userId: user?.id,
    dateFrom: monthStart,
    dateTo: monthEnd,
  })

  const { data: favorites = [] } = useFavorites(user?.id)
  const { data: calendarEvents = [] } = useCalendarEvents(user?.id)

  const savedEventIds = useMemo(() => {
    return new Set([
      ...favorites.map((favorite) => favorite.event_id),
      ...calendarEvents.map((calendarEvent) => calendarEvent.event_id),
    ])
  }, [calendarEvents, favorites])

  const savedIdsArray = useMemo(() => [...savedEventIds], [savedEventIds])
  const { data: savedEvents = [], isLoading: isSavedEventsLoading } = useEnrichedEvents({
    eventIds: savedIdsArray,
    userId: user?.id,
  })

  const baseFavoritedIds = useMemo(
    () =>
      new Set(
        [...monthEvents, ...savedEvents]
          .filter((event) => event.is_favorited || savedEventIds.has(event.id))
          .map((event) => event.id)
      ),
    [monthEvents, savedEventIds, savedEvents]
  )

  function isFavorited(eventId: string) {
    return favoriteOverrides[eventId] ?? baseFavoritedIds.has(eventId)
  }

  const eventsForSelectedDate = monthEvents.filter((event) => {
    const eventDate = new Date(event.start_datetime)
    return isSameDay(eventDate, selectedDate)
  })

  const upcomingCount = savedEvents.filter(
    (event) => new Date(event.start_datetime) >= new Date()
  ).length

  function getEventsForDay(day: Date) {
    return monthEvents.filter((event) => isSameDay(new Date(event.start_datetime), day))
  }

  function handleFavoriteToggle(eventId: string, newState: boolean) {
    setFavoriteOverrides((prev) => ({ ...prev, [eventId]: newState }))
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Calendar
          </p>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
            Your Adventures
          </h1>
        </div>
        <Tabs value={view} onValueChange={(v) => setView(v as "month" | "week")}>
          <TabsList className="h-9">
            <TabsTrigger value="month" className="text-xs gap-1.5 px-3">
              <CalendarDays className="h-3.5 w-3.5" />
              Month
            </TabsTrigger>
            <TabsTrigger value="week" className="text-xs gap-1.5 px-3">
              <List className="h-3.5 w-3.5" />
              Week
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isMonthEventsError && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">
            We couldn&apos;t load calendar events right now.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Calendar Grid — spans 3 cols */}
        <div className="lg:col-span-3 space-y-3">
          <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-sm">
            {/* Month navigation */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-base font-bold text-foreground tracking-tight">
                {format(currentMonth, "MMMM yyyy")}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="px-4 pb-4 pt-3">
              {/* Weekday headers */}
              <div className="grid grid-cols-7 mb-1">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                  <div
                    key={d}
                    className="text-center text-[11px] font-semibold text-muted-foreground py-2"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-0.5">
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {days.map((day) => {
                  const dayEvents = getEventsForDay(day)
                  const isSelected = isSameDay(day, selectedDate)
                  const isTodayDay = isToday(day)

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => setSelectedDate(day)}
                      className={cn(
                        "relative flex flex-col items-center justify-center h-11 rounded-xl text-sm transition-all group",
                        isSelected
                          ? "bg-primary text-primary-foreground font-bold shadow-sm"
                          : isTodayDay
                            ? "text-primary font-semibold ring-2 ring-primary/30 ring-inset hover:bg-primary/8"
                            : "hover:bg-accent text-foreground"
                      )}
                    >
                      <span className="leading-none">{format(day, "d")}</span>
                      {dayEvents.length > 0 && (
                        <div className="flex gap-0.5 mt-1">
                          {dayEvents.slice(0, 3).map((e) => (
                            <div
                              key={e.id}
                              className={cn(
                                "h-1 w-1 rounded-full",
                                isSelected
                                  ? "bg-primary-foreground/60"
                                  : isTodayDay
                                    ? "bg-primary"
                                    : "bg-muted-foreground/50"
                              )}
                            />
                          ))}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-5 px-1">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
              <span className="text-xs text-muted-foreground">Has events</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-4 w-4 rounded-full ring-2 ring-primary/40 ring-inset" />
              <span className="text-xs text-muted-foreground">Today</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-4 w-4 rounded-full bg-primary" />
              <span className="text-xs text-muted-foreground">Selected</span>
            </div>
          </div>
        </div>

        {/* Right panel — spans 2 cols */}
        <div className="lg:col-span-2 space-y-4">
          {/* Selected date events */}
          <div className="bg-card border border-border/60 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-foreground text-sm">
                  {isToday(selectedDate) ? "Today" : format(selectedDate, "EEEE")}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {format(selectedDate, "MMMM d, yyyy")}
                </p>
              </div>
              {eventsForSelectedDate.length > 0 && (
                <Badge variant="secondary" className="text-xs font-semibold">
                  {eventsForSelectedDate.length}{" "}
                  {eventsForSelectedDate.length === 1 ? "event" : "events"}
                </Badge>
              )}
            </div>

            {eventsForSelectedDate.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                  <CalendarDays className="h-5 w-5 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">Nothing planned</p>
                <p className="text-xs text-muted-foreground mb-4">No events on this day</p>
                <Button variant="outline" size="sm" className="text-xs h-8" asChild>
                  <Link to="/explore">Browse events</Link>
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {eventsForSelectedDate.map((event) => (
                  <EventCard
                    key={event.id}
                    event={{ ...event, is_favorited: isFavorited(event.id) }}
                    variant="compact"
                    onFavoriteToggle={handleFavoriteToggle}
                  />
                ))}
              </div>
            )}

            {isMonthEventsLoading && (
              <div className="p-4 space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <EventCardSkeleton key={`calendar-skeleton-${index}`} variant="compact" />
                ))}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card border border-border/60 rounded-2xl p-4 text-center shadow-sm">
              <div className="flex items-center justify-center mb-1">
                <Bookmark className="h-4 w-4 text-primary" />
              </div>
              <p className="text-2xl font-extrabold text-primary leading-none">
                {savedEventIds.size}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1 font-medium">Saved</p>
            </div>
            <div className="bg-card border border-border/60 rounded-2xl p-4 text-center shadow-sm">
              <div className="flex items-center justify-center mb-1">
                <CalendarDays className="h-4 w-4 text-primary" />
              </div>
              <p className="text-2xl font-extrabold text-primary leading-none">{upcomingCount}</p>
              <p className="text-[11px] text-muted-foreground mt-1 font-medium">Upcoming</p>
            </div>
          </div>
        </div>
      </div>

      {/* All saved events */}
      <section>
        <Separator className="mb-6" />
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground">Saved Events</h2>
          <span className="text-sm text-muted-foreground">{savedEvents.length} saved</span>
        </div>
        {isSavedEventsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <EventCardSkeleton key={`saved-events-skeleton-${index}`} />
            ))}
          </div>
        ) : savedEvents.length === 0 ? (
          <div className="py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Bookmark className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No saved events yet</h3>
            <p className="text-muted-foreground text-sm mb-5">
              Browse events and tap the heart to save them here.
            </p>
            <Button asChild>
              <Link to="/explore">Explore Events</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedEvents.map((event) => (
              <EventCard
                key={event.id}
                event={{ ...event, is_favorited: isFavorited(event.id) }}
                variant="default"
                onFavoriteToggle={handleFavoriteToggle}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
