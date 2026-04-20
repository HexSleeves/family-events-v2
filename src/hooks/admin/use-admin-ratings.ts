import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { AdminRating } from "./admin-types"

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
