import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { sanitizePostgrestLike } from "@/lib/utils"
import { enrichEvents } from "@/lib/enrich-events"
import type { Event, EventFilters, EventWithDetails } from "@/lib/types"

interface UseEventsOptions {
  filters?: EventFilters
  userId?: string
  enabled?: boolean
  limit?: number
  offset?: number
}

const OPEN_ENDED_MAX_AGE = 99
const DEFAULT_LIMIT = 100
const DEFAULT_OFFSET = 0

function toIsoDate(value: string | Date): string {
  return typeof value === "string" ? value : value.toISOString()
}

function normalizeKeyword(value: string): string {
  return sanitizePostgrestLike(value)
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

interface FetchEventsOptions {
  userId?: string
  limit?: number
  offset?: number
}

async function fetchEvents(
  filters: EventFilters = {},
  options: FetchEventsOptions = {}
): Promise<EventWithDetails[]> {
  const { userId, limit = DEFAULT_LIMIT, offset = 0 } = options

  const keyword = filters.keyword?.trim() ? normalizeKeyword(filters.keyword) : null
  const effectiveFeatured = filters.isFeatured ?? null

  // Generated Postgres RPC types require `undefined` for unset optional params.
  // Our callers still use `null` idiomatically, so normalise at the boundary.
  const rpcArgs = {
    p_city_id: filters.cityId ?? undefined,
    p_date_from: filters.dateFrom ? toIsoDate(filters.dateFrom) : undefined,
    p_date_to: filters.dateTo ? toIsoDate(filters.dateTo) : undefined,
    p_age_min: filters.ageMin ?? undefined,
    p_age_max: filters.ageMax ?? undefined,
    p_is_free: filters.isFree ?? undefined,
    p_is_featured: effectiveFeatured ?? undefined,
    p_tag_slugs:
      filters.tagSlugs && filters.tagSlugs.length > 0 ? filters.tagSlugs : undefined,
    p_keyword: keyword ?? undefined,
    p_status: filters.status ?? "published",
    p_limit: limit,
    p_offset: offset,
  }

  const { data, error } = await supabase.rpc("search_events", rpcArgs)

  if (error) {
    throw error
  }

  return enrichEvents((data ?? []) as Event[], { userId })
}

async function fetchEventById(eventId: string, userId?: string): Promise<EventWithDetails | null> {
  const { data, error } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle()

  if (error) {
    throw error
  }
  if (!data) {
    return null
  }

  const [event] = await enrichEvents([data as unknown as Event], { userId })
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

  return enrichEvents((data ?? []) as unknown as Event[], { userId })
}

export function useEvents(options: UseEventsOptions = {}) {
  const { filters = {}, userId, enabled = true, limit, offset } = options
  const resolvedLimit = limit ?? DEFAULT_LIMIT
  const resolvedOffset = offset ?? DEFAULT_OFFSET

  return useQuery({
    queryKey: ["events", filters, userId ?? null, resolvedLimit, resolvedOffset],
    queryFn: () => fetchEvents(filters, { userId, limit: resolvedLimit, offset: resolvedOffset }),
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

// Exported for tests
export { matchesAgeFilter, normalizeKeyword }
