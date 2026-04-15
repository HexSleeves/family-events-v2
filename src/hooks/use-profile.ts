import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { UserProfile } from "@/lib/types"

interface UpdateProfileInput {
  display_name?: string | null
  child_name?: string | null
  child_age?: number | null
  city_preference_id?: string | null
}

export function useUpdateProfile(userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: UpdateProfileInput) => {
      if (!userId) {
        throw new Error("You must be signed in to update your profile.")
      }

      const { data, error } = await supabase
        .from("user_profiles")
        .update(payload)
        .eq("id", userId)
        .select("*")
        .single()

      if (error) {
        throw error
      }

      return data as UserProfile
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["user-profile", userId ?? null] })
    },
  })
}
