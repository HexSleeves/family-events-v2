import { useState } from "react"
import { addDays } from "date-fns"
import {
  AdminInvitesEmptyState,
  AdminInvitesFooter,
  AdminInvitesHeader,
  AdminInvitesList,
} from "@/features/admin/components/admin-invites-sections"
import {
  generateInviteCode,
  useAdminInviteCodes,
  useCreateInviteCode,
  useDeleteInviteCode,
} from "@/features/auth/hooks/use-invites"
import { useAdminToast } from "@/features/admin/hooks/use-admin-toast"
import { toast } from "sonner"

type ExpiryOption = "7d" | "30d" | "never"

export function AdminInvitesPage() {
  const { data: codes = [] } = useAdminInviteCodes()
  const createCode = useCreateInviteCode()
  const deleteCode = useDeleteInviteCode()
  const { toastError } = useAdminToast()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [newCode, setNewCode] = useState({
    code: "",
    max_uses: 1,
    expires: "30d" as ExpiryOption,
    notes: "",
  })

  function resolveExpiry(expires: ExpiryOption): string | null {
    if (expires === "never") return null
    const days = expires === "7d" ? 7 : 30
    return addDays(new Date(), days).toISOString()
  }

  async function handleCreate() {
    const code = newCode.code.trim().toUpperCase() || generateInviteCode()
    if (code.length < 4) {
      toast.error("Code must be at least 4 characters")
      return
    }
    try {
      await createCode.mutateAsync({
        code,
        max_uses: newCode.max_uses,
        expires_at: resolveExpiry(newCode.expires),
        notes: newCode.notes.trim() || null,
      })
      setDialogOpen(false)
      setNewCode({ code: "", max_uses: 1, expires: "30d", notes: "" })
      toast.success(`Code created`, { description: code })
      await navigator.clipboard.writeText(code).catch(() => {})
    } catch (err) {
      toastError(err, "Failed to create code")
    }
  }

  async function handleCopy(code: string) {
    await navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 1500)
  }

  async function handleDelete(code: string) {
    try {
      await deleteCode.mutateAsync(code)
      toast.success(`Deleted ${code}`)
    } catch (err) {
      toastError(err, "Failed to delete")
    }
  }

  return (
    <div className="space-y-6">
      <AdminInvitesHeader
        codes={codes}
        dialogOpen={dialogOpen}
        newCode={newCode}
        isCreating={createCode.isPending}
        onDialogOpenChange={setDialogOpen}
        onCodeChange={(value) => setNewCode((prev) => ({ ...prev, code: value.toUpperCase() }))}
        onMaxUsesChange={(value) =>
          setNewCode((prev) => ({ ...prev, max_uses: Math.max(1, Number(value)) }))
        }
        onExpiryChange={(value) => setNewCode((prev) => ({ ...prev, expires: value }))}
        onNotesChange={(value) => setNewCode((prev) => ({ ...prev, notes: value }))}
        onCreate={handleCreate}
      />

      {codes.length === 0 ? (
        <AdminInvitesEmptyState />
      ) : (
        <AdminInvitesList
          codes={codes}
          copiedCode={copiedCode}
          onCopy={handleCopy}
          onDelete={handleDelete}
        />
      )}
      <AdminInvitesFooter />
    </div>
  )
}
