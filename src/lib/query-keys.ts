import type { Event, EventFilters } from "@/lib/types"

const DEFAULT_EVENT_STATUS: Event["status"] = "published"

type EnrichedEventsKeyOptions = {
  cityId?: string
  userId?: string
  status?: Event["status"]
  eventIds?: string[]
  dateFrom?: string | Date
  dateTo?: string | Date
}

type EventsKeyOptions = {
  filters?: EventFilters
  userId?: string
  limit: number
  offset: number
}

function nil<T>(value: T | null | undefined): T | null {
  return value ?? null
}

function toIsoDate(value: string | Date | undefined): string | null {
  if (!value) {
    return null
  }
  return typeof value === "string" ? value : value.toISOString()
}

function sortedUnique(values: readonly string[] | undefined): readonly string[] {
  return [...new Set(values ?? [])].sort()
}

function normalizeEventFilters(filters: EventFilters = {}) {
  return {
    cityId: nil(filters.cityId),
    dateFrom: nil(filters.dateFrom),
    dateTo: nil(filters.dateTo),
    ageMin: nil(filters.ageMin),
    ageMax: nil(filters.ageMax),
    isFree: nil(filters.isFree),
    tagSlugs: sortedUnique(filters.tagSlugs),
    keyword: filters.keyword?.trim() || null,
    isFeatured: nil(filters.isFeatured),
    status: filters.status ?? DEFAULT_EVENT_STATUS,
  } as const
}

function normalizeAdminEventsParams(keyword: string, status: Event["status"] | "all") {
  return {
    keyword: keyword.trim(),
    status,
  } as const
}

function enrichedEvents(options: EnrichedEventsKeyOptions = {}) {
  const { cityId, userId, status = DEFAULT_EVENT_STATUS, eventIds, dateFrom, dateTo } = options

  if (eventIds) {
    return ["events-enriched", "by-ids", sortedUnique(eventIds), nil(userId)] as const
  }

  return [
    "events-enriched",
    {
      cityId: nil(cityId),
      status,
      userId: nil(userId),
      dateFrom: toIsoDate(dateFrom),
      dateTo: toIsoDate(dateTo),
    },
  ] as const
}

export const qk = {
  favorites: {
    all: ["favorites"] as const,
    byUser: (userId: string | undefined) => ["favorites", nil(userId)] as const,
  },
  calendarEvents: {
    all: ["calendar-events"] as const,
    byUser: (userId: string | undefined) => ["calendar-events", nil(userId)] as const,
  },
  ratings: {
    all: ["ratings"] as const,
    byEvent: (eventId: string | undefined) => ["ratings", nil(eventId)] as const,
    userEvent: (userId: string | undefined, eventId: string | undefined) =>
      ["rating", nil(userId), nil(eventId)] as const,
  },
  comments: {
    all: ["comments"] as const,
    byEvent: (eventId: string | undefined) => ["comments", nil(eventId)] as const,
  },
  userProfile: {
    all: ["user-profile"] as const,
    byUser: (userId: string | undefined) => ["user-profile", nil(userId)] as const,
  },
  cities: {
    all: ["cities"] as const,
    active: ["cities", "active"] as const,
  },
  tags: {
    all: ["tags"] as const,
  },
  events: {
    all: ["events"] as const,
    list: ({ filters = {}, userId, limit, offset }: EventsKeyOptions) =>
      ["events", normalizeEventFilters(filters), nil(userId), limit, offset] as const,
    detailAll: ["event"] as const,
    detailById: (eventId: string | undefined) => ["event", nil(eventId)] as const,
    detail: (eventId: string | undefined, userId?: string) =>
      ["event", nil(eventId), nil(userId)] as const,
    byIdsAll: ["events-by-id"] as const,
    byIds: (eventIds: readonly string[], userId?: string) =>
      ["events-by-id", sortedUnique(eventIds), nil(userId)] as const,
  },
  enrichedEvents: {
    all: ["events-enriched"] as const,
    key: enrichedEvents,
  },
  invites: {
    required: ["invites-required"] as const,
  },
  admin: {
    root: ["admin"] as const,
    userAccess: ["admin", "user-access"] as const,
    cities: ["admin", "cities"] as const,
    comments: ["admin", "comments"] as const,
    eventAiTrace: (eventId: string | null | undefined) =>
      ["admin", "event-ai-trace", nil(eventId)] as const,
    sources: ["admin", "sources"] as const,
    sourceRuns: ["admin", "source-runs"] as const,
    stats: ["admin", "stats"] as const,
    events: {
      all: ["admin", "events"] as const,
      list: (keyword: string, status: Event["status"] | "all") =>
        ["admin", "events", normalizeAdminEventsParams(keyword, status)] as const,
    },
    ratings: ["admin", "ratings"] as const,
    inviteCodes: ["admin", "invite-codes"] as const,
  },
} as const
