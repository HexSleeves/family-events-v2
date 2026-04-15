import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { Tag } from "@/lib/types"

export const TAGS_QUERY_KEY = ["tags"] as const

async function fetchTags(): Promise<Tag[]> {
  const { data, error } = await supabase
    .from("tags")
    .select("*")
    .order("category", { ascending: true })
    .order("name", { ascending: true })

  if (error) {
    throw error
  }

  return data ?? []
}

export function useTags() {
  return useQuery({
    queryKey: TAGS_QUERY_KEY,
    queryFn: fetchTags,
  })
}
