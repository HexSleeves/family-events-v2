import { useMemo, useState } from "react"
import { Search, SlidersHorizontal, X, Music, TreePine, BookOpen, Users, Map } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { EventCard, EventCardSkeleton } from "@/components/event-card"
import { useApp } from "@/contexts/app-context"
import { useAuth } from "@/contexts/auth-context"
import { useEnrichedEvents } from "@/hooks/use-enriched-events"
import { matchesAgeFilter } from "@/hooks/use-events"
import { useTags } from "@/hooks/use-tags"

const CATEGORIES = [
  {
    label: "Playgroups",
    icon: Users,
    slug: "playgroup",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  {
    label: "Music & Movement",
    icon: Music,
    slug: "music",
    color: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
  },
  {
    label: "Outdoor Fun",
    icon: TreePine,
    slug: "outdoor",
    color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  {
    label: "Indoor Storytime",
    icon: BookOpen,
    slug: "storytime",
    color: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  },
]

const DATE_QUICK_FILTERS = [
  { label: "Today", value: "today" },
  { label: "This Weekend", value: "weekend" },
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
]

const AGE_OPTIONS = [
  { label: "0-1 yr", min: 0, max: 1 },
  { label: "1-3 yrs", min: 1, max: 3 },
  { label: "2-4 yrs", min: 2, max: 4 },
  { label: "5-8 yrs", min: 5, max: 8 },
  { label: "9+ yrs", min: 9, max: null },
]

export function ExplorePage() {
  const { user } = useAuth()
  const { selectedCity } = useApp()
  const [keyword, setKeyword] = useState("")
  const [activeDateFilter, setActiveDateFilter] = useState<string | null>(null)
  const [selectedAge, setSelectedAge] = useState<string | null>(null)
  const [onlyFree, setOnlyFree] = useState(false)
  const [selectedTagSlugs, setSelectedTagSlugs] = useState<string[]>([])
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [favoriteOverrides, setFavoriteOverrides] = useState<Record<string, boolean>>({})

  const ageFilter = AGE_OPTIONS.find((option) => option.label === selectedAge)

  const dateRange = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)

    if (activeDateFilter === "today") {
      const end = new Date(startOfToday)
      end.setDate(end.getDate() + 1)
      return { dateFrom: startOfToday.toISOString(), dateTo: end.toISOString() }
    }

    if (activeDateFilter === "weekend") {
      const day = startOfToday.getDay()
      const daysUntilSaturday = (6 - day + 7) % 7
      const saturday = new Date(startOfToday)
      saturday.setDate(startOfToday.getDate() + daysUntilSaturday)
      const sundayEnd = new Date(saturday)
      sundayEnd.setDate(saturday.getDate() + 2)
      return { dateFrom: saturday.toISOString(), dateTo: sundayEnd.toISOString() }
    }

    if (activeDateFilter === "week") {
      const end = new Date(startOfToday)
      end.setDate(end.getDate() + 7)
      return { dateFrom: startOfToday.toISOString(), dateTo: end.toISOString() }
    }

    if (activeDateFilter === "month") {
      const end = new Date(startOfToday)
      end.setMonth(end.getMonth() + 1)
      return { dateFrom: startOfToday.toISOString(), dateTo: end.toISOString() }
    }

    return { dateFrom: undefined, dateTo: undefined }
  }, [activeDateFilter])

  const combinedTagSlugs = useMemo(() => {
    const all = [...selectedTagSlugs]
    if (activeCategory && !all.includes(activeCategory)) {
      all.push(activeCategory)
    }
    return all
  }, [activeCategory, selectedTagSlugs])

  const { data: tags = [] } = useTags()
  const {
    data: allEvents = [],
    isLoading: isEventsLoading,
    isError: isEventsError,
  } = useEnrichedEvents({
    cityId: selectedCity?.id,
    userId: user?.id,
  })

  // Wave 2.2: the enriched RPC returns the published event list for a city;
  // explore-specific filters (keyword / date / age / free / tag) run here so
  // every list page shares a single cache entry.
  const filteredEvents = useMemo(() => {
    const trimmedKeyword = keyword.trim().toLowerCase()
    const from = dateRange.dateFrom ? new Date(dateRange.dateFrom) : null
    const to = dateRange.dateTo ? new Date(dateRange.dateTo) : null
    const tagSlugSet = combinedTagSlugs.length > 0 ? new Set(combinedTagSlugs) : null

    return allEvents.filter((event) => {
      if (trimmedKeyword) {
        const haystack =
          `${event.title} ${event.description ?? ""} ${event.venue_name ?? ""}`.toLowerCase()
        if (!haystack.includes(trimmedKeyword)) {
          return false
        }
      }

      if (from || to) {
        const start = new Date(event.start_datetime)
        if (from && start < from) return false
        if (to && start >= to) return false
      }

      if (onlyFree && !event.is_free) {
        return false
      }

      if (ageFilter && !matchesAgeFilter(event, ageFilter.min, ageFilter.max ?? undefined)) {
        return false
      }

      if (tagSlugSet) {
        const hasMatch = event.tags?.some((et) => tagSlugSet.has(et.tag.slug)) ?? false
        if (!hasMatch) return false
      }

      return true
    })
  }, [allEvents, keyword, dateRange, onlyFree, ageFilter, combinedTagSlugs])

  const baseFavoritedIds = useMemo(
    () => new Set(filteredEvents.filter((event) => event.is_favorited).map((event) => event.id)),
    [filteredEvents]
  )

  function isFavorited(eventId: string) {
    return favoriteOverrides[eventId] ?? baseFavoritedIds.has(eventId)
  }

  const activeFilterCount = [
    activeDateFilter,
    selectedAge,
    onlyFree ? "free" : null,
    ...selectedTagSlugs,
    activeCategory,
  ].filter(Boolean).length

  function clearAllFilters() {
    setActiveDateFilter(null)
    setSelectedAge(null)
    setOnlyFree(false)
    setSelectedTagSlugs([])
    setActiveCategory(null)
  }

  function handleFavoriteToggle(eventId: string, newState: boolean) {
    setFavoriteOverrides((prev) => ({ ...prev, [eventId]: newState }))
  }

  function toggleTagSlug(slug: string) {
    setSelectedTagSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
          Today&apos;s adventures, <span className="text-primary italic">hand-picked</span> for
          them.
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Discover the best family-friendly events in {selectedCity?.name ?? "your city"}, curated
          for every stage of play.
        </p>
      </div>

      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Find activities nearby..."
            className="pl-9 bg-muted border-0 h-11"
          />
          {keyword && (
            <button
              onClick={() => setKeyword("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="h-11 px-4 gap-2 border-border/60 relative">
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-80">
            <SheetHeader>
              <SheetTitle>Filter Events</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-6">
              <div>
                <p className="text-sm font-semibold mb-3">Date</p>
                <div className="flex flex-wrap gap-2">
                  {DATE_QUICK_FILTERS.map((f) => (
                    <button
                      key={f.value}
                      onClick={() =>
                        setActiveDateFilter((prev) => (prev === f.value ? null : f.value))
                      }
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                        activeDateFilter === f.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border hover:bg-accent"
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-sm font-semibold mb-3">Age Group</p>
                <div className="flex flex-wrap gap-2">
                  {AGE_OPTIONS.map((a) => (
                    <button
                      key={a.label}
                      onClick={() => setSelectedAge((prev) => (prev === a.label ? null : a.label))}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                        selectedAge === a.label
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border hover:bg-accent"
                      )}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="flex items-center gap-3">
                <Checkbox
                  id="free-only"
                  checked={onlyFree}
                  onCheckedChange={(v) => setOnlyFree(!!v)}
                />
                <Label htmlFor="free-only" className="font-medium">
                  Free events only
                </Label>
              </div>

              <Separator />

              <div>
                <p className="text-sm font-semibold mb-3">Tags</p>
                <div className="flex flex-col gap-2">
                  {tags.slice(0, 8).map((tag) => (
                    <div key={tag.id} className="flex items-center gap-3">
                      <Checkbox
                        id={`tag-${tag.slug}`}
                        checked={selectedTagSlugs.includes(tag.slug)}
                        onCheckedChange={() => toggleTagSlug(tag.slug)}
                      />
                      <Label htmlFor={`tag-${tag.slug}`} className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        {tag.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {activeFilterCount > 0 && (
                <Button variant="outline" className="w-full" onClick={clearAllFilters}>
                  Clear All Filters
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {onlyFree && (
            <Badge variant="secondary" className="gap-1">
              Free only
              <button onClick={() => setOnlyFree(false)}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {activeCategory && (
            <Badge variant="secondary" className="gap-1 capitalize">
              {activeCategory}
              <button onClick={() => setActiveCategory(null)}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {selectedTagSlugs.map((slug) => {
            const tag = tags.find((t) => t.slug === slug)
            return tag ? (
              <Badge key={slug} variant="secondary" className="gap-1">
                {tag.name}
                <button onClick={() => toggleTagSlug(slug)}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ) : null
          })}
        </div>
      )}

      {/* Explore by Joy categories */}
      {!keyword && !activeCategory && (
        <section>
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Explore by Joy
          </p>
          <p className="text-xs text-muted-foreground mb-3">Whatever they're into today</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {CATEGORIES.map(({ label, icon: Icon, slug, color }) => (
              <button
                key={slug}
                onClick={() => setActiveCategory((prev) => (prev === slug ? null : slug))}
                className={cn(
                  "rounded-2xl p-4 flex flex-col items-center gap-2 border-2 transition-all hover:scale-[1.02]",
                  activeCategory === slug
                    ? "border-primary bg-primary/5"
                    : "border-border/60 bg-card hover:border-primary/30"
                )}
              >
                <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-semibold text-center text-foreground leading-tight">
                  {label}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Events Grid */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground">
            {activeCategory
              ? CATEGORIES.find((c) => c.slug === activeCategory)?.label
              : "Happening Soon"}
          </h2>
          <span className="text-sm text-muted-foreground">{filteredEvents.length} events</span>
        </div>

        {isEventsError && (
          <Card className="border-destructive/30 bg-destructive/5 mb-4">
            <CardContent className="p-4 text-sm text-destructive">
              We couldn&apos;t load events. Try refreshing the page.
            </CardContent>
          </Card>
        )}

        {isEventsLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <EventCardSkeleton key={`explore-skeleton-${index}`} variant="list" />
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-16">
            <Search className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No events found</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Try adjusting your filters or search terms
            </p>
            <Button variant="outline" onClick={clearAllFilters}>
              Clear Filters
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEvents.map((event) => (
              <EventCard
                key={event.id}
                event={{ ...event, is_favorited: isFavorited(event.id) }}
                variant="list"
                onFavoriteToggle={handleFavoriteToggle}
              />
            ))}
          </div>
        )}
      </section>

      {/* New in your neighborhood */}
      <div className="rounded-2xl bg-muted/60 border border-border/60 p-6 text-center">
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Map className="h-5 w-5 text-primary" />
        </div>
        <h3 className="font-bold text-foreground mb-1">New in your neighborhood?</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Check out our interactive map for pop-up play spots.
        </p>
        <Button
          variant="outline"
          className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
        >
          View Map
        </Button>
      </div>
    </div>
  )
}
