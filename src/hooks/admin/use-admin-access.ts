import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { AdminUserAccessRecord } from "./admin-types"

export function useAdminUserAccess() {
  return useQuery({
    queryKey: ["admin", "user-access"],
    queryFn: async (): Promise<AdminUserAccessRecord[]> => {
      const { data, error } = await supabase
        .from("user_access")
        .select("*, user_profiles(display_name, email, role, created_at)")
        .order("created_at", { ascending: false })

      if (error) {
        throw error
      }

      return (data ?? []) as AdminUserAccessRecord[]
    },
  })
}

export function useUpdateAdminUserAccess() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      userId,
      isEnabled,
      disabledReason,
    }: {
      userId: string
      isEnabled: boolean
      disabledReason?: string | null
    }) => {
      const payload = isEnabled
        ? {
            is_enabled: true,
            enabled_at: new Date().toISOString(),
            disabled_at: null,
            disabled_reason: null,
            updated_at: new Date().toISOString(),
          }
        : {
            is_enabled: false,
            disabled_at: new Date().toISOString(),
            disabled_reason: disabledReason?.trim() || null,
            updated_at: new Date().toISOString(),
          }

      const { error } = await supabase.from("user_access").update(payload).eq("user_id", userId)
      if (error) {
        throw error
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "user-access"] })
    },
  })
}
