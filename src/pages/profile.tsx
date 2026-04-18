import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { User, LogOut, Shield, Moon, Sun, Monitor } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/contexts/auth-context"
import { useApp } from "@/contexts/app-context"
import { useTheme } from "@/components/theme-provider"
import { useUpdateProfile } from "@/hooks/use-profile"
import { toast } from "sonner"

export function ProfilePage() {
  const { user, profile, signOut, isAdmin, refreshProfile } = useAuth()
  const { selectedCity, setSelectedCity, cities, isCitiesLoading } = useApp()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const updateProfile = useUpdateProfile(user?.id)

  const [displayNameDraft, setDisplayNameDraft] = useState<string | null>(null)
  const [childNameDraft, setChildNameDraft] = useState<string | null>(null)
  const [childAgeDraft, setChildAgeDraft] = useState<string | null>(null)

  const displayName = displayNameDraft ?? profile?.display_name ?? ""
  const childName = childNameDraft ?? profile?.child_name ?? ""
  const childAge = childAgeDraft ?? profile?.child_age?.toString() ?? ""

  async function handleSignOut() {
    await signOut()
    navigate("/sign-in")
  }

  async function handleSaveProfile() {
    if (!user) {
      return
    }

    try {
      await updateProfile.mutateAsync({
        display_name: displayName.trim() || null,
        child_name: childName.trim() || null,
        child_age: childAge.trim() ? Number(childAge) : null,
        city_preference_id: selectedCity?.id ?? null,
      })
      await refreshProfile()
      setDisplayNameDraft(null)
      setChildNameDraft(null)
      setChildAgeDraft(null)
      toast.success("Profile updated!")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update profile.")
    }
  }

  if (!user) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center">
        <User className="h-16 w-16 text-muted-foreground/30 mx-auto mb-6" />
        <h1 className="text-2xl font-extrabold text-foreground mb-2">Your Profile</h1>
        <p className="text-muted-foreground mb-6">
          Sign in to manage your profile and preferences.
        </p>
        <Button asChild>
          <Link to="/sign-in">Sign In</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-extrabold text-foreground">Profile</h1>

      {/* User summary */}
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16 border-2 border-primary/20">
          <AvatarImage src={profile?.avatar_url || undefined} />
          <AvatarFallback className="text-xl bg-primary text-primary-foreground font-bold">
            {profile?.display_name?.charAt(0)?.toUpperCase() ?? "U"}
          </AvatarFallback>
        </Avatar>
        <div>
          <h2 className="text-lg font-bold text-foreground">{profile?.display_name}</h2>
          <p className="text-sm text-muted-foreground">{profile?.email}</p>
          {isAdmin && (
            <span className="inline-flex items-center gap-1 mt-1 text-xs font-semibold text-primary">
              <Shield className="h-3 w-3" />
              Admin
            </span>
          )}
        </div>
      </div>

      {/* Profile settings */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Personal Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Your Name</Label>
            <Input value={displayName} onChange={(e) => setDisplayNameDraft(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Child's Name (optional)</Label>
            <Input
              value={childName}
              onChange={(e) => setChildNameDraft(e.target.value)}
              placeholder="e.g. Leo"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Child&apos;s Age (optional)</Label>
            <Input
              type="number"
              min={0}
              max={18}
              value={childAge}
              onChange={(e) => setChildAgeDraft(e.target.value)}
              placeholder="e.g. 3"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Preferred City</Label>
            <Select
              value={selectedCity?.id ?? ""}
              onValueChange={(val) => {
                const city = cities.find((c) => c.id === val)
                if (city) setSelectedCity(city)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={isCitiesLoading ? "Loading cities..." : "Select city"} />
              </SelectTrigger>
              <SelectContent>
                {cities.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}, {c.state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSaveProfile} disabled={updateProfile.isPending}>
            {updateProfile.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      {/* Theme */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { value: "light", label: "Light", icon: Sun },
                { value: "dark", label: "Dark", icon: Moon },
                { value: "system", label: "System", icon: Monitor },
              ] as const
            ).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
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

      {/* Admin link */}
      {isAdmin && (
        <Button variant="outline" className="w-full gap-2 border-primary text-primary" asChild>
          <Link to="/admin">
            <Shield className="h-4 w-4" />
            Open Admin Dashboard
          </Link>
        </Button>
      )}

      <Separator />

      <Button variant="destructive" className="w-full gap-2" onClick={handleSignOut}>
        <LogOut className="h-4 w-4" />
        Sign Out
      </Button>
    </div>
  )
}
