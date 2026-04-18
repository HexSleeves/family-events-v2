import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "@/contexts/auth-context"

export function ProtectedRoute() {
  const { user, isEnabled, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!user || !isEnabled) {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
