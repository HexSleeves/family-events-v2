import { useMemo, useState } from "react"
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  addMonths,
  subMonths,
} from "date-fns"
import {
  CalendarErrorState,
  CalendarMonthPanel,
  CalendarSelectedDatePanel,
  CalendarStatsPanel,
  CalendarViewHeader,
  SavedEventsSection,
} from "@/components/calendar/calendar-view-sections"
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
      <CalendarViewHeader view={view} onViewChange={setView} />
      {isMonthEventsError && <CalendarErrorState />}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <CalendarMonthPanel
          currentMonth={currentMonth}
          selectedDate={selectedDate}
          firstDayOfWeek={firstDayOfWeek}
          days={days}
          getEventsForDay={getEventsForDay}
          onPreviousMonth={() => setCurrentMonth(subMonths(currentMonth, 1))}
          onNextMonth={() => setCurrentMonth(addMonths(currentMonth, 1))}
          onSelectDate={setSelectedDate}
        />
        <div className="lg:col-span-2 space-y-4">
          <CalendarSelectedDatePanel
            selectedDate={selectedDate}
            events={eventsForSelectedDate}
            isLoading={isMonthEventsLoading}
            isFavorited={isFavorited}
            onFavoriteToggle={handleFavoriteToggle}
          />
          <CalendarStatsPanel savedCount={savedEventIds.size} upcomingCount={upcomingCount} />
        </div>
      </div>
      <SavedEventsSection
        savedEvents={savedEvents}
        isLoading={isSavedEventsLoading}
        isFavorited={isFavorited}
        onFavoriteToggle={handleFavoriteToggle}
      />
    </div>
  )
}
