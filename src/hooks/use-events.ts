import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { Event, EventFilters, EventTag, EventWithDetails, Tag, City } from "@/lib/types"

interface EventTagWithTag extends EventTag {
  tag: Tag | null
}

interface UseEventsOptions {
  filters?: EventFilters
  userId?: string
  enabled?: boolean
}

const OPEN_ENDED_MAX_AGE = 99

function toIsoDate(value: string | Date): string {
  return typeof value === "string" ? value : value.toISOString()
}

function normalizeKeyword(value: string): string {
  return value.replaceAll("%", "").replaceAll(",", " ").trim()
}

function normalizeAgeBounds(event: Event) {
  return {
    min: event.age_min ?? 0,
    max: event.age_max ?? OPEN_ENDED_MAX_AGE,
  }
}

function matchesAgeFilter(event: Event, filterMin?: number, filterMax?: number): boolean {
  if (filterMin === undefined && filterMax === undefined) {
    return true
  }

  const { min, max } = normalizeAgeBounds(event)
  const rangeMin = filterMin ?? 0
  const rangeMax = filterMax ?? OPEN_ENDED_MAX_AGE

  return max >= rangeMin && min <= rangeMax
}

async function enrichEvents(events: Event[], userId?: string): Promise<EventWithDetails[]> {
  if (events.length === 0) {
    return []
  }

  const eventIds = events.map((event) => event.id)
  const cityIds = [...new Set(events.map((event) => event.city_id).filter(Boolean))] as string[]

  const [{ data: tagRowsRaw, error: tagError }, { data: ratingRows, error: ratingError }] =
    await Promise.all([
      supabase
        .from("event_tags")
        .select("event_id, tag_id, confidence, is_manual_override, created_at, tag:tags(*)")
        .in("event_id", eventIds),
      supabase.from("ratings").select("event_id, score").in("event_id", eventIds),
    ])

  if (tagError) {
    throw tagError
  }
  if (ratingError) {
    throw ratingError
  }

  let favoriteEventIds = new Set<string>()
  let calendarEventIds = new Set<string>()

  if (userId) {
    const [
      { data: favoriteRows, error: favoriteError },
      { data: calendarRows, error: calendarError },
    ] = await Promise.all([
      supabase.from("favorites").select("event_id").eq("user_id", userId).in("event_id", eventIds),
      supabase
        .from("user_calendar_events")
        .select("event_id")
        .eq("user_id", userId)
        .in("event_id", eventIds),
    ])

    if (favoriteError) {
      throw favoriteError
    }
    if (calendarError) {
      throw calendarError
    }

    favoriteEventIds = new Set((favoriteRows ?? []).map((row) => row.event_id))
    calendarEventIds = new Set((calendarRows ?? []).map((row) => row.event_id))
  }

  const cityMap = new Map<string, City>()
  if (cityIds.length > 0) {
    const { data: cityRows, error: cityError } = await supabase
      .from("cities")
      .select("*")
      .in("id", cityIds)

    if (cityError) {
      throw cityError
    }

    for (const city of cityRows ?? []) {
      cityMap.set(city.id, city)
    }
  }

  const tagsByEvent = new Map<string, Array<EventTag & { tag: Tag }>>()
  for (const rawRow of (tagRowsRaw ?? []) as EventTagWithTag[]) {
    if (!rawRow.tag) {
      continue
    }

    const current = tagsByEvent.get(rawRow.event_id) ?? []
    current.push({
      event_id: rawRow.event_id,
      tag_id: rawRow.tag_id,
      confidence: rawRow.confidence,
      is_manual_override: rawRow.is_manual_override,
      created_at: rawRow.created_at,
      tag: rawRow.tag,
    })
    tagsByEvent.set(rawRow.event_id, current)
  }

  const ratingStats = new Map<string, { sum: number; count: number }>()
  for (const rating of ratingRows ?? []) {
    const current = ratingStats.get(rating.event_id) ?? { sum: 0, count: 0 }
    current.sum += rating.score
    current.count += 1
    ratingStats.set(rating.event_id, current)
  }

  return events.map((event) => {
    const stats = ratingStats.get(event.id)
    return {
      ...event,
      city: event.city_id ? (cityMap.get(event.city_id) ?? null) : null,
      tags: tagsByEvent.get(event.id) ?? [],
      avg_rating: stats ? Number((stats.sum / stats.count).toFixed(1)) : undefined,
      rating_count: stats?.count,
      is_favorited: favoriteEventIds.has(event.id),
      is_in_calendar: calendarEventIds.has(event.id),
    }
  })
}

async function fetchEvents(
  filters: EventFilters = {},
  userId?: string
): Promise<EventWithDetails[]> {
  let query = supabase.from("events").select("*").order("start_datetime", { ascending: true })

  if (filters.status) {
    query = query.eq("status", filters.status)
  } else {
    query = query.eq("status", "published")
  }

  if (filters.cityId) {
    query = query.eq("city_id", filters.cityId)
  }
  if (filters.dateFrom) {
    query = query.gte("start_datetime", toIsoDate(filters.dateFrom))
  }
  if (filters.dateTo) {
    query = query.lte("start_datetime", toIsoDate(filters.dateTo))
  }
  if (filters.isFree !== undefined) {
    query = query.eq("is_free", filters.isFree)
  }

  const isFeaturedFilter = (filters as EventFilters & { isFeatured?: boolean }).isFeatured
  if (filters.isFeatures !== undefined) {
    query = query.eq("is_featured", filters.isFeatures)
  } else if (isFeaturedFilter !== undefined) {
    query = query.eq("is_featured", isFeaturedFilter)
  }

  if (filters.keyword?.trim()) {
    const keyword = normalizeKeyword(filters.keyword)
    if (keyword) {
      query = query.or(`title.ilike.%${keyword}%,description.ilike.%${keyword}%`)
    }
  }

  const { data, error } = await query
  if (error) {
    throw error
  }

  let events = await enrichEvents(data ?? [], userId)

  if (filters.ageMin !== undefined || filters.ageMax !== undefined) {
    events = events.filter((event) => matchesAgeFilter(event, filters.ageMin, filters.ageMax))
  }

  if (filters.tagSlugs && filters.tagSlugs.length > 0) {
    events = events.filter((event) =>
      filters.tagSlugs?.every((slug) => event.tags?.some((eventTag) => eventTag.tag.slug === slug))
    )
  }

  return events
}

async function fetchEventById(eventId: string, userId?: string): Promise<EventWithDetails | null> {
  const { data, error } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle()

  if (error) {
    throw error
  }
  if (!data) {
    return null
  }

  const [event] = await enrichEvents([data], userId)
  return event ?? null
}

async function fetchEventsByIds(eventIds: string[], userId?: string): Promise<EventWithDetails[]> {
  if (eventIds.length === 0) {
    return []
  }

  const uniqueEventIds = [...new Set(eventIds)]
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .in("id", uniqueEventIds)
    .order("start_datetime", { ascending: true })

  if (error) {
    throw error
  }

  return enrichEvents(data ?? [], userId)
}

export function useEvents(options: UseEventsOptions = {}) {
  const { filters = {}, userId, enabled = true } = options

  return useQuery({
    queryKey: ["events", filters, userId ?? null],
    queryFn: () => fetchEvents(filters, userId),
    enabled,
  })
}

export function useEvent(eventId: string | undefined, userId?: string) {
  return useQuery({
    queryKey: ["event", eventId, userId ?? null],
    queryFn: () => fetchEventById(eventId!, userId),
    enabled: Boolean(eventId),
  })
}

export function useEventsByIds(eventIds: string[], userId?: string) {
  return useQuery({
    queryKey: ["events-by-id", eventIds, userId ?? null],
    queryFn: () => fetchEventsByIds(eventIds, userId),
  })
}
