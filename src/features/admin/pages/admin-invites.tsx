import { useState } from "react"
import { addDays } from "date-fns"
import {
  AdminInvitesCreatedReveal,
  AdminInvitesEmptyState,
  AdminInvitesFooter,
  AdminInvitesHeader,
  AdminInvitesList,
} from "@/features/admin/components/admin-invites-sections"
import {
  useAdminInviteCodes,
  useCreateInviteCode,
  useDeleteInviteCode,
} from "@/features/auth/hooks/use-invites"
import { useAdminToast } from "@/features/admin/hooks/use-admin-toast"
import { toast } from "sonner"
import type { CreatedInviteCode } from "@/lib/types"

type ExpiryOption = "7d" | "30d" | "never"

export function AdminInvitesPage() {
  const { data: codes = [] } = useAdminInviteCodes()
  const createCode = useCreateInviteCode()
  const deleteCode = useDeleteInviteCode()
  const { toastError } = useAdminToast()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [justCreated, setJustCreated] = useState<CreatedInviteCode | null>(null)
  const [revealCopied, setRevealCopied] = useState(false)
  const [newCode, setNewCode] = useState({
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
    try {
      const created = await createCode.mutateAsync({
        max_uses: newCode.max_uses,
        expires_at: resolveExpiry(newCode.expires),
        notes: newCode.notes.trim() || null,
      })
      setDialogOpen(false)
      setNewCode({ max_uses: 1, expires: "30d", notes: "" })
      setJustCreated(created)
      setRevealCopied(false)
      // Auto-copy on creation so admin only has to dismiss if they don't need it.
      await navigator.clipboard.writeText(created.code).catch(() => {})
      setRevealCopied(true)
      toast.success("Code generated and copied to clipboard")
    } catch (err) {
      toastError(err, "Failed to create code")
    }
  }

  async function handleCopyReveal() {
    if (!justCreated) return
    try {
      await navigator.clipboard.writeText(justCreated.code)
      setRevealCopied(true)
      setTimeout(() => setRevealCopied(false), 1500)
    } catch {
      toast.error("Clipboard unavailable")
    }
  }

  function handleDismissReveal() {
    setJustCreated(null)
    setRevealCopied(false)
  }

  async function handleDelete(id: string) {
    try {
      await deleteCode.mutateAsync(id)
      toast.success("Code deleted")
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
        onMaxUsesChange={(value) =>
          setNewCode((prev) => ({ ...prev, max_uses: Math.max(1, Number(value)) }))
        }
        onExpiryChange={(value) => setNewCode((prev) => ({ ...prev, expires: value }))}
        onNotesChange={(value) => setNewCode((prev) => ({ ...prev, notes: value }))}
        onCreate={handleCreate}
      />

      {justCreated && (
        <AdminInvitesCreatedReveal
          created={justCreated}
          copied={revealCopied}
          onCopy={handleCopyReveal}
          onDismiss={handleDismissReveal}
        />
      )}

      {codes.length === 0 ? (
        <AdminInvitesEmptyState />
      ) : (
        <AdminInvitesList codes={codes} onDelete={handleDelete} />
      )}
      <AdminInvitesFooter />
    </div>
  )
}
