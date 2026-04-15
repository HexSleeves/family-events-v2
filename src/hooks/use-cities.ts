import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { City } from "@/lib/types"

export const ACTIVE_CITIES_QUERY_KEY = ["cities", "active"] as const

async function fetchActiveCities(): Promise<City[]> {
  const { data, error } = await supabase
    .from("cities")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true })

  if (error) {
    throw error
  }

  return data ?? []
}

export function useCities() {
  return useQuery({
    queryKey: ACTIVE_CITIES_QUERY_KEY,
    queryFn: fetchActiveCities,
  })
}
