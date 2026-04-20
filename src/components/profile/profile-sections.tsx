import { Link } from "react-router-dom"
import { LogOut, Monitor, Moon, Shield, Sun, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { Database } from "@/lib/database.types"

type City = Database["public"]["Tables"]["cities"]["Row"]
type ThemeOption = "light" | "dark" | "system"

interface ProfileGuestStateProps {
  signInHref: string
}

export function ProfileGuestState({ signInHref }: ProfileGuestStateProps) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-20 text-center">
      <User className="h-16 w-16 text-muted-foreground/30 mx-auto mb-6" />
      <h1 className="text-2xl font-extrabold text-foreground mb-2">Your Profile</h1>
      <p className="text-muted-foreground mb-6">Sign in to manage your profile and preferences.</p>
      <Button asChild>
        <Link to={signInHref}>Sign In</Link>
      </Button>
    </div>
  )
}

interface ProfileUserSummaryProps {
  displayName?: string | null
  email?: string | null
  avatarUrl?: string | null
  isAdmin: boolean
}

export function ProfileUserSummary({
  displayName,
  email,
  avatarUrl,
  isAdmin,
}: ProfileUserSummaryProps) {
  return (
    <div className="flex items-center gap-4">
      <Avatar className="h-16 w-16 border-2 border-primary/20">
        <AvatarImage src={avatarUrl || undefined} />
        <AvatarFallback className="text-xl bg-primary text-primary-foreground font-bold">
          {displayName?.charAt(0)?.toUpperCase() ?? "U"}
        </AvatarFallback>
      </Avatar>
      <div>
        <h2 className="text-lg font-bold text-foreground">{displayName}</h2>
        <p className="text-sm text-muted-foreground">{email}</p>
        {isAdmin && (
          <span className="inline-flex items-center gap-1 mt-1 text-xs font-semibold text-primary">
            <Shield className="h-3 w-3" />
            Admin
          </span>
        )}
      </div>
    </div>
  )
}

interface ProfileThemeCardProps {
  theme: ThemeOption
  onThemeChange: (value: ThemeOption) => void
}

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const satisfies { value: ThemeOption; label: string; icon: typeof Sun }[]

export function ProfileThemeCard({ theme, onThemeChange }: ProfileThemeCardProps) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Appearance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => onThemeChange(value)}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-sm font-medium ${
                theme === value
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border hover:border-primary/40 text-muted-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function ProfileAdminLink({ href }: { href: string }) {
  return (
    <Button variant="outline" className="w-full gap-2 border-primary text-primary" asChild>
      <Link to={href}>
        <Shield className="h-4 w-4" />
        Open Admin Dashboard
      </Link>
    </Button>
  )
}

export function ProfileSignOutButton({ onSignOut }: { onSignOut: () => void }) {
  return (
    <Button variant="destructive" className="w-full gap-2" onClick={onSignOut}>
      <LogOut className="h-4 w-4" />
      Sign Out
    </Button>
  )
}

export function resolveSelectedCity(cities: City[], cityId: string) {
  return cities.find((city) => city.id === cityId)
}
