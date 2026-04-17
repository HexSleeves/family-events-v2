import { Outlet, Link, useLocation, useNavigate } from "react-router-dom"
import {
  Hop as Home,
  Compass,
  Map as MapIcon,
  Bookmark,
  User,
  Search,
  ChevronDown,
  LogOut,
  Shield,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/contexts/auth-context"
import { useApp } from "@/contexts/app-context"
import { useIsMobile } from "@/hooks/use-mobile"

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/map", label: "Map", icon: MapIcon },
  { to: "/saved", label: "Saved", icon: Bookmark },
  { to: "/profile", label: "Profile", icon: User },
]

export function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, profile, signOut, isAdmin } = useAuth()
  const { selectedCity, setSelectedCity, cities } = useApp()
  const isMobile = useIsMobile()

  function isActive(to: string) {
    if (to === "/") return location.pathname === "/"
    return location.pathname.startsWith(to)
  }

  async function handleSignOut() {
    await signOut()
    navigate("/sign-in")
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border/60">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-sm font-black">F</span>
            </div>
            <span className="font-extrabold text-foreground tracking-tight hidden sm:block">
              Family<span className="text-primary">Events</span>
            </span>
          </Link>

          <div className="flex items-center gap-2 flex-1 max-w-xs">
            <Select
              value={selectedCity?.id || ""}
              onValueChange={(val) => {
                const city = cities.find((c) => c.id === val)
                if (city) setSelectedCity(city)
              }}
            >
              <SelectTrigger className="h-8 text-sm bg-muted border-0 gap-1">
                <SelectValue placeholder="Select city" />
              </SelectTrigger>
              <SelectContent>
                {cities.map((city) => (
                  <SelectItem key={city.id} value={city.id}>
                    {city.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link to="/explore">
                <Search className="h-4 w-4" />
              </Link>
            </Button>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 h-8 px-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={profile?.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                        {profile?.display_name?.charAt(0)?.toUpperCase() ?? "U"}
                      </AvatarFallback>
                    </Avatar>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-semibold">{profile?.display_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="gap-2">
                      <User className="h-4 w-4" /> Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/saved" className="gap-2">
                      <Bookmark className="h-4 w-4" /> My Events
                    </Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link to="/admin" className="gap-2 text-primary">
                          <Shield className="h-4 w-4" /> Admin Dashboard
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="gap-2 text-destructive focus:text-destructive"
                  >
                    <LogOut className="h-4 w-4" /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-8 text-sm" asChild>
                  <Link to="/sign-in">Sign In</Link>
                </Button>
                <Button size="sm" className="h-8 text-sm" asChild>
                  <Link to="/sign-up">Join Free</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Desktop nav */}
      {!isMobile && (
        <nav className="sticky top-14 z-30 bg-background/95 backdrop-blur border-b border-border/40">
          <div className="max-w-5xl mx-auto px-4 flex items-center gap-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors border-b-2",
                  isActive(to)
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                to="/admin"
                className={cn(
                  "flex items-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors border-b-2 ml-auto",
                  location.pathname.startsWith("/admin")
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Shield className="h-4 w-4" />
                Admin
              </Link>
            )}
          </div>
        </nav>
      )}

      {/* Page content */}
      <main className={cn("flex-1", isMobile && "pb-20")}>
        <Outlet />
      </main>

      {/* Mobile Bottom Tab Bar */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-t border-border/60">
          <div className="flex items-center justify-around px-2 py-2">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
              const active = isActive(to)
              return (
                <Link key={to} to={to} className="flex flex-col items-center gap-0.5 min-w-0 px-3">
                  <div
                    className={cn(
                      "flex items-center justify-center rounded-xl transition-all",
                      to === "/explore" ? "h-11 w-11" : "h-8 w-8",
                      active && to === "/explore" ? "bg-primary shadow-md" : active ? "" : ""
                    )}
                  >
                    <Icon
                      className={cn(
                        "transition-colors",
                        to === "/explore" && active ? "h-5 w-5 text-primary-foreground" : "h-5 w-5",
                        active && to !== "/explore" ? "text-primary" : "",
                        !active ? "text-muted-foreground" : ""
                      )}
                    />
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-medium",
                      active ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {label}
                  </span>
                </Link>
              )
            })}
          </div>
        </nav>
      )}
    </div>
  )
}
