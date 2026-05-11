import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "@/stores/auth-store"
import { HOME_PATH } from "@/lib/access-control"
import { FadeSwap } from "@/components/motion"

export function PublicOnlyRoute() {
  const { user, isEnabled, isLoading } = useAuth()

  if (isLoading) {
    return (
      <FadeSwap stateKey="public-loading">
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </FadeSwap>
    )
  }

  if (user && isEnabled) {
    return <Navigate to={HOME_PATH} replace />
  }

  return (
    <FadeSwap stateKey="public-content">
      <Outlet />
    </FadeSwap>
  )
}
