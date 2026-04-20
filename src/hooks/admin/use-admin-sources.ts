import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { validateExternalUrl } from "../../../supabase/functions/_shared/url-validation"
import type { EventSource } from "@/lib/types"

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
      return (data ?? []) as unknown as EventSource[]
    },
  })
}

export function useCreateAdminSource() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: Omit<EventSource, "id" | "created_at" | "updated_at">) => {
      if (payload.source_type !== "manual") {
        const validation = validateExternalUrl(payload.url)
        if (!validation.ok) {
          throw new Error(validation.reason ?? "Invalid source URL")
        }
      }
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
      if (updates.url !== undefined && updates.source_type !== "manual") {
        const validation = validateExternalUrl(updates.url)
        if (!validation.ok) {
          throw new Error(validation.reason ?? "Invalid source URL")
        }
      }
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
