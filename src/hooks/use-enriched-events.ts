import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { Event, EventTag, EventWithDetails, Tag } from "@/lib/types"

interface UseEnrichedEventsOptions {
  cityId?: string
  userId?: string
  status?: Event["status"]
  limit?: number
  offset?: number
  enabled?: boolean
  /**
   * When set, the RPC returns exactly those events, bypassing the
   * city/status/limit/offset filters. Used by my-events and event-detail
   * so saved-ids and single-id fetches share the enriched path.
   */
  eventIds?: string[]
  /** Inclusive lower bound on start_datetime (passed as ISO string to the RPC). */
  dateFrom?: string | Date
  /** Inclusive upper bound on start_datetime (passed as ISO string to the RPC). */
  dateTo?: string | Date
}

const DEFAULT_LIMIT = 100
const DEFAULT_OFFSET = 0
const DEFAULT_STATUS: Event["status"] = "published"

function toIsoDate(value: string | Date): string {
  return typeof value === "string" ? value : value.toISOString()
}

// Shape the RPC emits for each tag (jsonb_agg of tag columns).
interface EnrichedTagJson {
  id: string
  name: string
  slug: string
  color: string
}

// Adapt the RPC's flat tag array into EventWithDetails' nested EventTag + Tag
// shape so EventCard / TagBadge / admin list rendering stays drop-in.
function adaptTags(eventId: string, raw: unknown): (EventTag & { tag: Tag })[] {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw
    .filter((t): t is EnrichedTagJson => {
      return typeof t === "object" && t !== null && typeof (t as EnrichedTagJson).id === "string"
    })
    .map((t) => ({
      event_id: eventId,
      tag_id: t.id,
      confidence: 1,
      is_manual_override: false,
      created_at: "",
      tag: {
        id: t.id,
        name: t.name,
        slug: t.slug,
        color: t.color,
        category: "",
        is_system: false,
        created_at: "",
      },
    }))
}

export function adaptEnrichedRow(row: Record<string, unknown>): EventWithDetails {
  const eventId = row.id as string
  const tags = adaptTags(eventId, row.tags)

  // RPC typings mark columns as non-null, but the underlying events table
  // allows null for description/end_datetime/venue_name/etc. Cast through the
  // EventWithDetails contract (which already models those nullables).
  const event = row as unknown as Event

  return {
    ...event,
    images: Array.isArray(event.images) ? event.images : [],
    tags,
    avg_rating: typeof row.avg_rating === "number" ? row.avg_rating : 0,
    rating_count: typeof row.rating_count === "number" ? row.rating_count : 0,
    is_favorited: row.is_favorited === true,
    is_in_calendar: row.is_in_calendar === true,
  }
}

// Exported for unit tests. Mirrors the RPC signature exactly — when
// p_event_ids is set the server ignores city/status/limit/offset, so we
// elide those keys client-side to keep the payload honest.
export function buildEnrichedRpcArgs(options: UseEnrichedEventsOptions) {
  const {
    cityId,
    userId,
    status = DEFAULT_STATUS,
    limit = DEFAULT_LIMIT,
    offset = DEFAULT_OFFSET,
    eventIds,
    dateFrom,
    dateTo,
  } = options

  return {
    p_city_id: eventIds ? undefined : (cityId ?? undefined),
    p_status: eventIds ? undefined : status,
    p_limit: eventIds ? undefined : limit,
    p_offset: eventIds ? undefined : offset,
    p_user_id: userId ?? undefined,
    p_event_ids: eventIds,
    p_date_from: dateFrom ? toIsoDate(dateFrom) : undefined,
    p_date_to: dateTo ? toIsoDate(dateTo) : undefined,
  }
}

// Exported for unit tests. Two key shapes:
//  - by-ids:   ["events-enriched", "by-ids", sortedIds, userId]
//  - list:     ["events-enriched", { cityId, status, userId, dateFrom, dateTo }]
// IDs are sorted so caller insertion-order does not fragment the cache.
export function buildEnrichedQueryKey(options: UseEnrichedEventsOptions) {
  const { cityId, userId, status = DEFAULT_STATUS, eventIds, dateFrom, dateTo } = options

  if (eventIds) {
    const sortedIds = [...eventIds].sort()
    return ["events-enriched", "by-ids", sortedIds, userId ?? null] as const
  }

  return [
    "events-enriched",
    {
      cityId: cityId ?? null,
      status,
      userId: userId ?? null,
      dateFrom: dateFrom ? toIsoDate(dateFrom) : null,
      dateTo: dateTo ? toIsoDate(dateTo) : null,
    },
  ] as const
}

async function fetchEnrichedEvents(options: UseEnrichedEventsOptions): Promise<EventWithDetails[]> {
  // Short-circuit empty id arrays — RPC would return 0 rows anyway, skip the round-trip.
  if (options.eventIds && options.eventIds.length === 0) {
    return []
  }

  const { data, error } = await supabase.rpc("events_enriched", buildEnrichedRpcArgs(options))

  if (error) {
    throw error
  }

  return (data ?? []).map((row) => adaptEnrichedRow(row as Record<string, unknown>))
}

export function useEnrichedEvents(options: UseEnrichedEventsOptions = {}) {
  const { enabled = true } = options

  return useQuery({
    queryKey: buildEnrichedQueryKey(options),
    queryFn: () => fetchEnrichedEvents(options),
    enabled,
  })
}

export const ENRICHED_EVENTS_QUERY_KEY = "events-enriched" as const
