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
}

const DEFAULT_LIMIT = 100
const DEFAULT_OFFSET = 0
const DEFAULT_STATUS: Event["status"] = "published"

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

async function fetchEnrichedEvents(options: UseEnrichedEventsOptions): Promise<EventWithDetails[]> {
  const {
    cityId,
    userId,
    status = DEFAULT_STATUS,
    limit = DEFAULT_LIMIT,
    offset = DEFAULT_OFFSET,
  } = options

  const { data, error } = await supabase.rpc("events_enriched", {
    p_city_id: cityId ?? undefined,
    p_status: status,
    p_limit: limit,
    p_offset: offset,
    p_user_id: userId ?? undefined,
  })

  if (error) {
    throw error
  }

  return (data ?? []).map((row) => adaptEnrichedRow(row as Record<string, unknown>))
}

export function useEnrichedEvents(options: UseEnrichedEventsOptions = {}) {
  const {
    cityId,
    userId,
    status = DEFAULT_STATUS,
    limit = DEFAULT_LIMIT,
    offset = DEFAULT_OFFSET,
    enabled = true,
  } = options

  // Canonical key: only the three dimensions that change the result set
  // identity. limit/offset ride along inside the queryFn so paginated views
  // still get fresh fetches without fragmenting invalidation.
  return useQuery({
    queryKey: ["events-enriched", { cityId: cityId ?? null, status, userId: userId ?? null }],
    queryFn: () => fetchEnrichedEvents({ cityId, userId, status, limit, offset }),
    enabled,
  })
}

export const ENRICHED_EVENTS_QUERY_KEY = "events-enriched" as const
