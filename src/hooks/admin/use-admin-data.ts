import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { sanitizePostgrestLike } from "@/lib/utils"
import { enrichEvents } from "@/lib/enrich-events"
import type {
  City,
  Comment,
  Event,
  EventSource,
  EventWithDetails,
  Rating,
  SourceRun,
} from "@/lib/types"

export interface AdminComment extends Comment {
  user_profiles: { display_name: string | null } | null
  events: { title: string | null } | null
}

export interface AdminRating extends Rating {
  user_profiles: { display_name: string | null } | null
  events: { title: string | null } | null
}

export interface AdminSourceRun extends SourceRun {
  event_sources: { name: string | null } | null
}

interface AdminStats {
  totalEvents: number
  pendingReview: number
  published: number
  activeSources: number
  sourceErrors: number
  aiBuckets: {
    high: number
    medium: number
    low: number
  }
}

async function enrichAdminEvents(events: Event[]): Promise<EventWithDetails[]> {
  // Admin views don't need per-user state (favorites, calendar) or rating stats.
  return enrichEvents(events, { includeRatings: false, includeUserState: false })
}

export function useAdminEvents(keyword: string, status: Event["status"] | "all") {
  return useQuery({
    queryKey: ["admin", "events", keyword, status],
    queryFn: async (): Promise<EventWithDetails[]> => {
      let query = supabase.from("events").select("*").order("created_at", { ascending: false })

      if (status !== "all") {
        query = query.eq("status", status)
      }
      const sanitized = sanitizePostgrestLike(keyword)
      if (sanitized) {
        query = query.or(`title.ilike.%${sanitized}%,description.ilike.%${sanitized}%`)
      }

      const { data, error } = await query
      if (error) {
        throw error
      }

      return enrichAdminEvents(data ?? [])
    },
  })
}

export function useUpdateAdminEventStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ eventId, status }: { eventId: string; status: Event["status"] }) => {
      const { error } = await supabase.from("events").update({ status }).eq("id", eventId)
      if (error) {
        throw error
      }
      return status
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "events"] })
      void queryClient.invalidateQueries({ queryKey: ["events"] })
      void queryClient.invalidateQueries({ queryKey: ["event"] })
    },
  })
}

export function useBatchUpdateAdminEventStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ eventIds, status }: { eventIds: string[]; status: Event["status"] }) => {
      const { error } = await supabase.from("events").update({ status }).in("id", eventIds)
      if (error) {
        throw error
      }
      return { count: eventIds.length, status }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "events"] })
      void queryClient.invalidateQueries({ queryKey: ["events"] })
      void queryClient.invalidateQueries({ queryKey: ["event"] })
    },
  })
}

export function useUpdateAdminEventTags() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ eventId, tagIds }: { eventId: string; tagIds: string[] }) => {
      const { error: deleteError } = await supabase
        .from("event_tags")
        .delete()
        .eq("event_id", eventId)
        .eq("is_manual_override", false)

      if (deleteError) {
        throw deleteError
      }

      if (tagIds.length > 0) {
        const rows = tagIds.map((tagId) => ({
          event_id: eventId,
          tag_id: tagId,
          confidence: 1,
          is_manual_override: true,
        }))
        const { error: insertError } = await supabase.from("event_tags").upsert(rows, {
          onConflict: "event_id,tag_id",
        })
        if (insertError) {
          throw insertError
        }
      }

      return true
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "events"] })
      void queryClient.invalidateQueries({ queryKey: ["events"] })
      void queryClient.invalidateQueries({ queryKey: ["event"] })
    },
  })
}

export function useAdminSources() {
  return useQuery({
    queryKey: ["admin", "sources"],
    queryFn: async (): Promise<EventSource[]> => {
      const { data, error } = await supabase
        .from("event_sources")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) {
        throw error
      }
      return data ?? []
    },
  })
}

export function useCreateAdminSource() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: Omit<EventSource, "id" | "created_at" | "updated_at">) => {
      const { error } = await supabase.from("event_sources").insert(payload)
      if (error) {
        throw error
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "sources"] })
    },
  })
}

export function useUpdateAdminSource() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      sourceId,
      updates,
    }: {
      sourceId: string
      updates: Partial<Omit<EventSource, "id" | "created_at">>
    }) => {
      const { error } = await supabase.from("event_sources").update(updates).eq("id", sourceId)
      if (error) {
        throw error
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "sources"] })
    },
  })
}

export function useTriggerSourceScrape() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ sourceId }: { sourceId: string }) => {
      const { data, error } = await supabase.functions.invoke("scrape-source", {
        body: { source_id: sourceId },
      })

      if (error) {
        throw error
      }

      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "sources"] })
      void queryClient.invalidateQueries({ queryKey: ["admin", "source-runs"] })
      void queryClient.invalidateQueries({ queryKey: ["admin", "stats"] })
    },
  })
}

export function useAdminCities() {
  return useQuery({
    queryKey: ["admin", "cities"],
    queryFn: async (): Promise<City[]> => {
      const { data, error } = await supabase
        .from("cities")
        .select("*")
        .order("name", { ascending: true })
      if (error) {
        throw error
      }
      return data ?? []
    },
  })
}

export function useCreateAdminCity() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      payload: Omit<City, "id" | "created_at" | "latitude" | "longitude" | "is_active">
    ) => {
      const { error } = await supabase.from("cities").insert({
        ...payload,
        latitude: null,
        longitude: null,
        is_active: true,
      })
      if (error) {
        throw error
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "cities"] })
      void queryClient.invalidateQueries({ queryKey: ["cities", "active"] })
    },
  })
}

export function useUpdateAdminCity() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      cityId,
      updates,
    }: {
      cityId: string
      updates: Partial<Omit<City, "id" | "created_at">>
    }) => {
      const { error } = await supabase.from("cities").update(updates).eq("id", cityId)
      if (error) {
        throw error
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "cities"] })
      void queryClient.invalidateQueries({ queryKey: ["cities", "active"] })
    },
  })
}

export function useAdminComments() {
  return useQuery({
    queryKey: ["admin", "comments"],
    queryFn: async (): Promise<AdminComment[]> => {
      const { data, error } = await supabase
        .from("comments")
        .select("*, user_profiles(display_name), events(title)")
        .order("created_at", { ascending: false })

      if (error) {
        throw error
      }

      return (data ?? []) as AdminComment[]
    },
  })
}

export function useUpdateAdminComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      commentId,
      updates,
    }: {
      commentId: string
      updates: Partial<Pick<Comment, "is_approved" | "is_flagged">>
    }) => {
      const { error } = await supabase.from("comments").update(updates).eq("id", commentId)
      if (error) {
        throw error
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "comments"] })
      void queryClient.invalidateQueries({ queryKey: ["comments"] })
    },
  })
}

export function useDeleteAdminComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ commentId }: { commentId: string }) => {
      const { error } = await supabase.from("comments").delete().eq("id", commentId)
      if (error) {
        throw error
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "comments"] })
      void queryClient.invalidateQueries({ queryKey: ["comments"] })
    },
  })
}

export function useAdminRatings() {
  return useQuery({
    queryKey: ["admin", "ratings"],
    queryFn: async (): Promise<AdminRating[]> => {
      const { data, error } = await supabase
        .from("ratings")
        .select("*, user_profiles(display_name), events(title)")
        .order("created_at", { ascending: false })

      if (error) {
        throw error
      }

      return (data ?? []) as AdminRating[]
    },
  })
}

export function useDeleteAdminRating() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ ratingId }: { ratingId: string }) => {
      const { error } = await supabase.from("ratings").delete().eq("id", ratingId)
      if (error) {
        throw error
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "ratings"] })
      void queryClient.invalidateQueries({ queryKey: ["ratings"] })
      void queryClient.invalidateQueries({ queryKey: ["events"] })
      void queryClient.invalidateQueries({ queryKey: ["event"] })
    },
  })
}

export function useAdminSourceRuns() {
  return useQuery({
    queryKey: ["admin", "source-runs"],
    queryFn: async (): Promise<AdminSourceRun[]> => {
      const { data, error } = await supabase
        .from("source_runs")
        .select("*, event_sources(name)")
        .order("started_at", { ascending: false })
        .limit(50)

      if (error) {
        throw error
      }
      return (data ?? []) as AdminSourceRun[]
    },
  })
}

export function useAdminStats() {
  return useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async (): Promise<AdminStats> => {
      const [{ data: events, error: eventsError }, { data: sources, error: sourcesError }] =
        await Promise.all([
          supabase.from("events").select("status, ai_confidence"),
          supabase.from("event_sources").select("is_active, last_status"),
        ])

      if (eventsError) {
        throw eventsError
      }
      if (sourcesError) {
        throw sourcesError
      }

      const eventRows = events ?? []
      const sourceRows = sources ?? []

      const totalEvents = eventRows.length
      const pendingReview = eventRows.filter((event) => event.status === "draft").length
      const published = eventRows.filter((event) => event.status === "published").length
      const activeSources = sourceRows.filter((source) => source.is_active).length
      const sourceErrors = sourceRows.filter(
        (source) => source.is_active && source.last_status === "error"
      ).length

      const confidenceValues = eventRows
        .map((event) => event.ai_confidence)
        .filter((value): value is number => typeof value === "number")

      const totalConfidenceRows = confidenceValues.length || 1
      const high = Math.round(
        (confidenceValues.filter((value) => value >= 0.9).length / totalConfidenceRows) * 100
      )
      const medium = Math.round(
        (confidenceValues.filter((value) => value >= 0.7 && value < 0.9).length /
          totalConfidenceRows) *
          100
      )
      const low = Math.max(0, 100 - high - medium)

      return {
        totalEvents,
        pendingReview,
        published,
        activeSources,
        sourceErrors,
        aiBuckets: {
          high,
          medium,
          low,
        },
      }
    },
  })
}
