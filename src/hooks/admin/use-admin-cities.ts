import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { City } from "@/lib/types"

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
