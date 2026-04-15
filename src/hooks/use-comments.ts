import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { CommentWithProfile } from "@/lib/types"

export function useComments(eventId: string | undefined) {
  return useQuery({
    queryKey: ["comments", eventId ?? null],
    queryFn: async (): Promise<CommentWithProfile[]> => {
      if (!eventId) {
        return []
      }

      const { data, error } = await supabase
        .from("comments")
        .select("*, user_profiles(display_name, avatar_url)")
        .eq("event_id", eventId)
        .eq("is_approved", true)
        .order("created_at", { ascending: false })

      if (error) {
        throw error
      }

      return (data ?? []) as CommentWithProfile[]
    },
    enabled: Boolean(eventId),
  })
}

interface AddCommentInput {
  eventId: string
  body: string
}

export function useAddComment(userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ eventId, body }: AddCommentInput) => {
      if (!userId) {
        throw new Error("You must be signed in to comment.")
      }

      const { data, error } = await supabase
        .from("comments")
        .insert({
          user_id: userId,
          event_id: eventId,
          body,
          is_approved: true,
          is_flagged: false,
        })
        .select("*")
        .single()

      if (error) {
        throw error
      }

      return data
    },
    onSuccess: (_comment, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["comments", variables.eventId] })
    },
  })
}
