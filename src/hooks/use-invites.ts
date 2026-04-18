import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { InviteCode } from "@/lib/types"

// Used by sign-up page: do we need to collect a code?
export function useInvitesRequired() {
  return useQuery({
    queryKey: ["invites-required"],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc("invites_required")
      if (error) throw error
      return Boolean(data)
    },
    staleTime: 5 * 60 * 1000, // cache for 5 min
  })
}

// Atomic consume. Returns true on success; false if invalid/expired/exhausted.
export async function redeemInvite(code: string, email: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("redeem_invite_for_email", {
    p_code: code,
    p_email: email,
  })
  if (error) throw error
  return Boolean(data)
}

// Admin: list all codes
export function useAdminInviteCodes() {
  return useQuery({
    queryKey: ["admin", "invite-codes"],
    queryFn: async (): Promise<InviteCode[]> => {
      const { data, error } = await supabase
        .from("invite_codes")
        .select("*")
        .order("created_at", { ascending: false })
      if (error) throw error
      return (data ?? []) as InviteCode[]
    },
  })
}

export function useCreateInviteCode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      code: string
      max_uses: number
      expires_at: string | null
      notes: string | null
    }) => {
      const { error } = await supabase.from("invite_codes").insert(payload)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "invite-codes"] })
    },
  })
}

export function useDeleteInviteCode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (code: string) => {
      const { error } = await supabase.from("invite_codes").delete().eq("code", code)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "invite-codes"] })
    },
  })
}

// Cryptographically random 8-char uppercase alphanumeric (no ambiguous 0/O/1/I).
export function generateInviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")
}
