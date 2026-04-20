import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { sanitizePostgrestLike } from "@/lib/utils"
import { enrichAdminEvents } from "./admin-events-shared"
import type { Event, EventWithDetails } from "@/lib/types"

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

      return enrichAdminEvents((data ?? []) as unknown as Event[])
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
