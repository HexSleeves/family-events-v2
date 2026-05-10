import { useMemo, useState } from "react"
import { useApp } from "@/contexts/app-context"
import { useAuth } from "@/contexts/auth-context"
import { useEnrichedEvents } from "@/hooks/use-enriched-events"
import { matchesAgeFilter } from "@/hooks/use-events"
import { useTags } from "@/hooks/use-tags"
import {
  AGE_OPTIONS,
  ExploreActiveFilters,
  ExploreCategoryGrid,
  ExploreEventsSection,
  ExploreHeader,
  ExploreNeighborhoodCta,
  ExploreSearchFilters,
} from "@/components/explore/explore-sections"

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
      <ExploreHeader cityName={selectedCity?.name} />
      <ExploreSearchFilters
        keyword={keyword}
        activeFilterCount={activeFilterCount}
        activeDateFilter={activeDateFilter}
        selectedAge={selectedAge}
        onlyFree={onlyFree}
        selectedTagSlugs={selectedTagSlugs}
        tags={tags}
        onKeywordChange={setKeyword}
        onClearKeyword={() => setKeyword("")}
        onDateFilterChange={setActiveDateFilter}
        onAgeChange={setSelectedAge}
        onOnlyFreeChange={setOnlyFree}
        onToggleTagSlug={toggleTagSlug}
        onClearAllFilters={clearAllFilters}
      />
      <ExploreActiveFilters
        onlyFree={onlyFree}
        activeCategory={activeCategory}
        selectedTagSlugs={selectedTagSlugs}
        tags={tags}
        onOnlyFreeChange={setOnlyFree}
        onActiveCategoryChange={setActiveCategory}
        onToggleTagSlug={toggleTagSlug}
      />
      <ExploreCategoryGrid
        keyword={keyword}
        activeCategory={activeCategory}
        onActiveCategoryChange={setActiveCategory}
      />
      <ExploreEventsSection
        activeCategory={activeCategory}
        filteredEvents={filteredEvents}
        isEventsLoading={isEventsLoading}
        isEventsError={isEventsError}
        isFavorited={isFavorited}
        onFavoriteToggle={handleFavoriteToggle}
        onClearAllFilters={clearAllFilters}
      />
      <ExploreNeighborhoodCta />
    </div>
  )
}
