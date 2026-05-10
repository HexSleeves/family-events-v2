import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { qk } from "@/lib/query-keys"
import { supabase } from "@/lib/supabase"
import type { Favorite } from "@/lib/types"

export function useFavorites(userId: string | undefined) {
  return useQuery({
    queryKey: qk.favorites.byUser(userId),
    queryFn: async (): Promise<Favorite[]> => {
      if (!userId) {
        return []
      }

      const { data, error } = await supabase
        .from("favorites")
        .select("id, user_id, event_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

      if (error) {
        throw error
      }

      return data ?? []
    },
    enabled: Boolean(userId),
  })
}

interface ToggleFavoriteInput {
  eventId: string
  isFavorited: boolean
}

export function useToggleFavorite(userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ eventId, isFavorited }: ToggleFavoriteInput) => {
      if (!userId) {
        throw new Error("You must be signed in to favorite events.")
      }

      if (isFavorited) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", userId)
          .eq("event_id", eventId)
        if (error) {
          throw error
        }
        return false
      }

      const { error } = await supabase
        .from("favorites")
        .insert({ user_id: userId, event_id: eventId })
      if (error) {
        throw error
      }
      return true
    },
    onSuccess: (_isNowFavorited, variables) => {
      void queryClient.invalidateQueries({ queryKey: qk.favorites.byUser(userId) })
      void queryClient.invalidateQueries({ queryKey: qk.events.all })
      void queryClient.invalidateQueries({ queryKey: qk.enrichedEvents.all })
      void queryClient.invalidateQueries({ queryKey: qk.events.detailById(variables.eventId) })
      void queryClient.invalidateQueries({ queryKey: qk.events.byIdsAll })
    },
  })
}
