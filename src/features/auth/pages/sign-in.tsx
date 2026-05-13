import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "@/features/auth/stores/auth-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { HOME_PATH } from "@/lib/access-control"
import { humanizeSupabaseError } from "@/lib/humanize-supabase-error"
import { RequestInviteDialog } from "@/features/auth/components/request-invite-dialog"
import { toast } from "sonner"

// Only treat string `from` values that look like in-app paths. Anything else
// (full URL, javascript:, missing leading /) falls back to HOME_PATH — this
// keeps a malicious referer or stale state from triggering an open redirect.
function resolveRedirectTarget(rawFrom: unknown): string {
  if (typeof rawFrom !== "string") return HOME_PATH
  if (!rawFrom.startsWith("/") || rawFrom.startsWith("//")) return HOME_PATH
  return rawFrom
}

export function SignInPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = resolveRedirectTarget((location.state as { from?: unknown } | null)?.from)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) {
      toast.error("Sign in failed", {
        description: humanizeSupabaseError(error, "Please try again."),
      })
    } else {
      toast.success("Welcome back!")
      navigate(redirectTo, { replace: true })
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <div className="h-10 w-10 rounded-2xl bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-lg font-black">F</span>
            </div>
          </Link>
          <h1 className="text-2xl font-extrabold text-foreground">Welcome back</h1>
          <p className="text-muted-foreground text-sm mt-1">Sign in to discover family events</p>
        </div>

        <Card className="border-border/60">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-muted-foreground hover:text-primary hover:underline"
                  >
                    Forgot?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Don't have an account?{" "}
          <Link to="/sign-up" className="text-primary font-medium hover:underline">
            Use invite
          </Link>
        </p>
        <div className="text-center mt-2">
          <RequestInviteDialog defaultEmail={email} />
        </div>
      </div>
    </div>
  )
}
