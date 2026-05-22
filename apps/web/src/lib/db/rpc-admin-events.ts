import { z } from "zod"

import { adminEventFacetRowSchema, eventRowSchema, parseRowsWithSentry } from "@/lib/schemas"
import { supabase } from "@/lib/supabase"
import type { Event } from "@/lib/types"

export interface AdminEventsCursor {
  afterCreatedAt?: string
  afterId?: string
}

export interface AdminEventsFilters {
  status?: Event["status"]
  cityId?: string
  cityIsNull?: boolean
  keyword?: string
  limit?: number
}

export interface AdminEventsPageResult {
  rows: Event[]
  totalCount: number
  nextCursor?: AdminEventsCursor
}

export interface AdminEventFacetRow {
  city_id: string | null
  status: Event["status"]
  count: number
}

const defaultAdminEventsLimit = 200
const maxAdminEventsLimit = 500

const adminEventEnrichedRowSchema = eventRowSchema.extend({
  total_count: z.coerce.number().int().nonnegative(),
})

function normalizeAdminEventsLimit(limit?: number) {
  const requested = limit ?? defaultAdminEventsLimit
  const clamped = Math.min(Math.max(requested, 1), maxAdminEventsLimit)
  return clamped
}

export async function fetchAdminEventsPage(
  filters: AdminEventsFilters,
  cursor?: AdminEventsCursor
): Promise<AdminEventsPageResult> {
  const limit = normalizeAdminEventsLimit(filters.limit)
  const { data, error } = await (supabase.rpc as any)("admin_events_enriched", {
    p_status: filters.status,
    p_city_id: filters.cityId,
    p_city_is_null: filters.cityIsNull,
    p_keyword: filters.keyword,
    p_after_created_at: cursor?.afterCreatedAt,
    p_after_id: cursor?.afterId,
    p_limit: limit,
  })
  if (error) {
    throw error
  }

  const rows = parseRowsWithSentry(adminEventEnrichedRowSchema, data ?? [], {
    area: "admin.events.list",
  })
  const loadedCount = rows.length
  const totalCount = rows[0]?.total_count ?? 0

  return {
    rows,
    totalCount,
    nextCursor:
      loadedCount > 0 && loadedCount < totalCount
        ? {
            afterCreatedAt: rows[loadedCount - 1].created_at,
            afterId: rows[loadedCount - 1].id,
          }
        : undefined,
  }
}
