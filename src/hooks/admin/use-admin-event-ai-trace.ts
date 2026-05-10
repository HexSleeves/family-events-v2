import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { normalizeAiTrace } from "./admin-types"
import type { EventAiTrace } from "@/lib/types"

export function useAdminEventAiTrace(eventId: string | null) {
  return useQuery({
    queryKey: ["admin", "event-ai-trace", eventId],
    enabled: Boolean(eventId),
    queryFn: async () => {
      if (!eventId) {
        return null
      }

      const { data, error } = await supabase
        .from("event_ai_traces")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        throw error
      }

      return normalizeAiTrace((data ?? null) as EventAiTrace | null)
    },
  })
}

export function useUpdateAdminEventTags() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ eventId, tagIds }: { eventId: string; tagIds: string[] }) => {
      const dedupedTagIds = [...new Set(tagIds)]

      const [{ data: existingTags, error: existingTagsError }, authResult] = await Promise.all([
        supabase.from("event_tags").select("tag_id").eq("event_id", eventId),
        supabase.auth.getUser(),
      ])

      if (existingTagsError) {
        throw existingTagsError
      }
      if (authResult.error) {
        throw authResult.error
      }

      const adminUserId = authResult.data.user?.id
      if (!adminUserId) {
        throw new Error("Authenticated admin required to save tag overrides.")
      }

      const previousTagIds = [...new Set((existingTags ?? []).map((row) => row.tag_id))]
      const addedTagIds = dedupedTagIds.filter((tagId) => !previousTagIds.includes(tagId))
      const removedTagIds = previousTagIds.filter((tagId) => !dedupedTagIds.includes(tagId))

      const { error: deleteError } = await supabase
        .from("event_tags")
        .delete()
        .eq("event_id", eventId)
      if (deleteError) {
        throw deleteError
      }

      if (dedupedTagIds.length > 0) {
        const rows = dedupedTagIds.map((tagId) => ({
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

      const { error: auditError } = await supabase.from("admin_audit_log").insert({
        admin_user_id: adminUserId,
        action: "event.tags.override",
        target_type: "event",
        target_id: eventId,
        metadata: {
          previous_tag_ids: previousTagIds,
          new_tag_ids: dedupedTagIds,
          added_tag_ids: addedTagIds,
          removed_tag_ids: removedTagIds,
        },
      })
      if (auditError) {
        throw auditError
      }

      return eventId
    },
    onSuccess: (eventId) => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "events"] })
      void queryClient.invalidateQueries({ queryKey: ["admin", "event-ai-trace", eventId] })
      void queryClient.invalidateQueries({ queryKey: ["events"] })
      void queryClient.invalidateQueries({ queryKey: ["event"] })
    },
  })
}
