import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { Rating } from "@/lib/types"

export function useRatings(eventId: string | undefined) {
  return useQuery({
    queryKey: ["ratings", eventId ?? null],
    queryFn: async (): Promise<Rating[]> => {
      if (!eventId) {
        return []
      }

      const { data, error } = await supabase
        .from("ratings")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })

      if (error) {
        throw error
      }

      return data ?? []
    },
    enabled: Boolean(eventId),
  })
}

export function useUserRating(userId: string | undefined, eventId: string | undefined) {
  return useQuery({
    queryKey: ["rating", userId ?? null, eventId ?? null],
    queryFn: async (): Promise<Rating | null> => {
      if (!userId || !eventId) {
        return null
      }

      const { data, error } = await supabase
        .from("ratings")
        .select("*")
        .eq("user_id", userId)
        .eq("event_id", eventId)
        .maybeSingle()

      if (error) {
        throw error
      }

      return data ?? null
    },
    enabled: Boolean(userId && eventId),
  })
}

interface UpsertRatingInput {
  eventId: string
  score: number
}

export function useUpsertRating(userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ eventId, score }: UpsertRatingInput) => {
      if (!userId) {
        throw new Error("You must be signed in to rate events.")
      }

      const { data, error } = await supabase
        .from("ratings")
        .upsert(
          {
            user_id: userId,
            event_id: eventId,
            score,
          },
          { onConflict: "user_id,event_id" }
        )
        .select("*")
        .single()

      if (error) {
        throw error
      }

      return data
    },
    onSuccess: (_rating, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["ratings", variables.eventId] })
      void queryClient.invalidateQueries({
        queryKey: ["rating", userId ?? null, variables.eventId],
      })
      void queryClient.invalidateQueries({ queryKey: ["events"] })
      void queryClient.invalidateQueries({ queryKey: ["event", variables.eventId] })
      void queryClient.invalidateQueries({ queryKey: ["events-by-id"] })
    },
  })
}
