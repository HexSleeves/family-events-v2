import { useState } from "react"
import { format, addDays } from "date-fns"
import { Plus, Copy, Trash2, Check, Ticket } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  generateInviteCode,
  useAdminInviteCodes,
  useCreateInviteCode,
  useDeleteInviteCode,
} from "@/hooks/use-invites"
import { toast } from "sonner"

type ExpiryOption = "7d" | "30d" | "never"

const EXPIRY_LABELS: Record<ExpiryOption, string> = {
  "7d": "7 days",
  "30d": "30 days",
  never: "Never",
}

export function AdminInvitesPage() {
  const { data: codes = [] } = useAdminInviteCodes()
  const createCode = useCreateInviteCode()
  const deleteCode = useDeleteInviteCode()

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
      toast.error(err instanceof Error ? err.message : "Failed to create code")
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
      toast.error(err instanceof Error ? err.message : "Failed to delete")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-foreground">Invite Codes</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {codes.length} code{codes.length === 1 ? "" : "s"} ·{" "}
            {codes.reduce((sum, c) => sum + c.used_count, 0)} total uses
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> New Code
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate invite code</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Code (optional — leave blank to auto-generate)</Label>
                <Input
                  value={newCode.code}
                  onChange={(e) =>
                    setNewCode((p) => ({ ...p, code: e.target.value.toUpperCase() }))
                  }
                  placeholder="e.g. BETA2026"
                  className="font-mono tracking-widest uppercase"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Max uses</Label>
                  <Input
                    type="number"
                    min={1}
                    value={newCode.max_uses}
                    onChange={(e) =>
                      setNewCode((p) => ({ ...p, max_uses: Math.max(1, Number(e.target.value)) }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Expires in</Label>
                  <Select
                    value={newCode.expires}
                    onValueChange={(v) => setNewCode((p) => ({ ...p, expires: v as ExpiryOption }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7d">7 days</SelectItem>
                      <SelectItem value="30d">30 days</SelectItem>
                      <SelectItem value="never">Never</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Notes (who's this for?)</Label>
                <Input
                  value={newCode.notes}
                  onChange={(e) => setNewCode((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="e.g. Friends & family batch"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={createCode.isPending}>
                {createCode.isPending ? "Creating..." : "Create & Copy"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {codes.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="p-8 text-center space-y-3">
            <Ticket className="h-8 w-8 mx-auto text-muted-foreground" />
            <h2 className="text-lg font-bold">No invite codes yet</h2>
            <p className="text-sm text-muted-foreground">
              Generate codes to let specific people sign up during the closed beta.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {codes.map((code) => {
            const expired = code.expires_at ? new Date(code.expires_at) < new Date() : false
            const exhausted = code.used_count >= code.max_uses
            const dead = expired || exhausted

            return (
              <Card
                key={code.code}
                className={dead ? "border-border/40 opacity-60" : "border-border/60"}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="font-mono text-sm font-bold tracking-widest text-foreground">
                        {code.code}
                      </code>
                      <Badge variant="outline" className="text-[10px]">
                        {code.used_count}/{code.max_uses} used
                      </Badge>
                      {expired && (
                        <Badge variant="destructive" className="text-[10px]">
                          Expired
                        </Badge>
                      )}
                      {exhausted && !expired && (
                        <Badge variant="secondary" className="text-[10px]">
                          Exhausted
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span>Created {format(new Date(code.created_at), "MMM d, h:mm a")}</span>
                      {code.expires_at && (
                        <span>Expires {format(new Date(code.expires_at), "MMM d")}</span>
                      )}
                      {code.notes && <span className="italic">{code.notes}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => handleCopy(code.code)}
                    >
                      {copiedCode === code.code ? (
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(code.code)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <div className="text-xs text-muted-foreground border-t border-border/40 pt-4 space-y-1">
        <p className="font-semibold">Gate status</p>
        <p>
          The signup gate is controlled by the{" "}
          <code className="font-mono text-[11px]">app.settings.require_invite</code> database
          setting. When <code className="font-mono text-[11px]">true</code>, sign-up requires a
          code. Unset now defaults to <code className="font-mono text-[11px]">true</code>. Local
          override lives in <code className="font-mono text-[11px]">scripts/setup-local.sh</code>.
        </p>
        <p className="pt-1">Ignored expiry labels: {Object.values(EXPIRY_LABELS).join(", ")}.</p>
      </div>
    </div>
  )
}
