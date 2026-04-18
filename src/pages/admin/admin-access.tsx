import { useMemo, useState } from "react"
import { format } from "date-fns"
import { ShieldCheck, ShieldOff, UserRound, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAuth } from "@/contexts/auth-context"
import { useAdminUserAccess, useUpdateAdminUserAccess } from "@/hooks/admin/use-admin-data"
import { toast } from "sonner"

export function AdminAccessPage() {
  const { user, refreshProfile } = useAuth()
  const { data: accounts = [] } = useAdminUserAccess()
  const updateAccess = useUpdateAdminUserAccess()

  const [query, setQuery] = useState("")
  const [dialogUserId, setDialogUserId] = useState<string | null>(null)
  const [disabledReason, setDisabledReason] = useState("")

  const filteredAccounts = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) {
      return accounts
    }

    return accounts.filter((account) => {
      const haystack = [
        account.user_profiles?.display_name ?? "",
        account.user_profiles?.email ?? "",
        account.user_profiles?.role ?? "",
      ]
        .join(" ")
        .toLowerCase()

      return haystack.includes(normalized)
    })
  }, [accounts, query])

  async function applyAccessChange(userId: string, isEnabled: boolean, reason?: string) {
    try {
      await updateAccess.mutateAsync({
        userId,
        isEnabled,
        disabledReason: reason ?? null,
      })
      toast.success(isEnabled ? "Account re-enabled" : "Account disabled")
      if (userId === user?.id) {
        await refreshProfile().catch(() => {})
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update account access")
    }
  }

  async function handleDisableConfirm() {
    if (!dialogUserId) {
      return
    }

    await applyAccessChange(dialogUserId, false, disabledReason)
    setDialogUserId(null)
    setDisabledReason("")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-foreground">Account Access</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Enable or disable invited accounts without deleting them.
          </p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or email"
            className="pl-9"
          />
        </div>
      </div>

      <div className="space-y-3">
        {filteredAccounts.map((account) => {
          const profile = account.user_profiles
          const isSelf = account.user_id === user?.id

          return (
            <Card key={account.user_id} className="border-border/60">
              <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {profile?.display_name || profile?.email || account.user_id}
                      </p>
                      <Badge variant={account.is_enabled ? "secondary" : "destructive"}>
                        {account.is_enabled ? "Enabled" : "Disabled"}
                      </Badge>
                      {profile?.role === "admin" && <Badge variant="outline">Admin</Badge>}
                      {isSelf && <Badge variant="outline">You</Badge>}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {profile?.email || "No email on file"}
                    </p>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>Joined {format(new Date(account.created_at), "MMM d, yyyy")}</span>
                      {account.disabled_at && (
                        <span>Disabled {format(new Date(account.disabled_at), "MMM d, yyyy")}</span>
                      )}
                    </div>
                    {account.disabled_reason && (
                      <p className="text-xs text-muted-foreground italic">
                        Reason: {account.disabled_reason}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 gap-2">
                  {account.is_enabled ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="gap-2"
                      onClick={() => setDialogUserId(account.user_id)}
                    >
                      <ShieldOff className="h-4 w-4" />
                      Disable
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => applyAccessChange(account.user_id, true)}
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Re-enable
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}

        {filteredAccounts.length === 0 && (
          <Card className="border-border/60">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No matching accounts.
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={dialogUserId !== null} onOpenChange={(open) => !open && setDialogUserId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable account</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="disable-reason">Reason (optional)</Label>
            <Textarea
              id="disable-reason"
              value={disabledReason}
              onChange={(event) => setDisabledReason(event.target.value)}
              placeholder="Explain why this account is being disabled."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogUserId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisableConfirm}
              disabled={updateAccess.isPending}
            >
              {updateAccess.isPending ? "Disabling..." : "Disable account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
