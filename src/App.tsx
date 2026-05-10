import { lazy, Suspense } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "@/components/theme-provider"
import { AppErrorBoundary } from "@/components/app-error-boundary"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { PublicOnlyRoute } from "@/components/auth/public-only-route"
import { AuthProvider } from "@/contexts/auth-context"
import { AppProvider } from "@/contexts/app-context"
import { Toaster } from "@/components/ui/sonner"
import { HOME_PATH } from "@/lib/access-control"
import { queryClient } from "@/lib/query-client"

import { AppLayout } from "@/layouts/app-layout"
import { AdminLayout } from "@/layouts/admin-layout"

const DashboardPage = lazy(() =>
  import("@/pages/dashboard").then((module) => ({
    default: module.DashboardPage,
  }))
)
const ExplorePage = lazy(() =>
  import("@/pages/explore").then((module) => ({
    default: module.ExplorePage,
  }))
)
const EventDetailPage = lazy(() =>
  import("@/pages/event-detail").then((module) => ({
    default: module.EventDetailPage,
  }))
)
const CalendarViewPage = lazy(() =>
  import("@/pages/calendar-view").then((module) => ({
    default: module.CalendarViewPage,
  }))
)
const MapViewPage = lazy(() =>
  import("@/pages/map-view").then((module) => ({
    default: module.MapViewPage,
  }))
)
const MarketingPage = lazy(() =>
  import("@/pages/marketing").then((module) => ({
    default: module.MarketingPage,
  }))
)
const MyEventsPage = lazy(() =>
  import("@/pages/my-events").then((module) => ({
    default: module.MyEventsPage,
  }))
)
const ProfilePage = lazy(() =>
  import("@/pages/profile").then((module) => ({
    default: module.ProfilePage,
  }))
)

const SignInPage = lazy(() =>
  import("@/pages/auth/sign-in").then((module) => ({
    default: module.SignInPage,
  }))
)
const SignUpPage = lazy(() =>
  import("@/pages/auth/sign-up").then((module) => ({
    default: module.SignUpPage,
  }))
)

const AdminDashboardPage = lazy(() =>
  import("@/pages/admin/admin-dashboard").then((module) => ({
    default: module.AdminDashboardPage,
  }))
)
const AdminSourcesPage = lazy(() =>
  import("@/pages/admin/admin-sources").then((module) => ({
    default: module.AdminSourcesPage,
  }))
)
const AdminEventsPage = lazy(() =>
  import("@/pages/admin/admin-events").then((module) => ({
    default: module.AdminEventsPage,
  }))
)
const AdminCitiesPage = lazy(() =>
  import("@/pages/admin/admin-cities").then((module) => ({
    default: module.AdminCitiesPage,
  }))
)
const AdminCommentsPage = lazy(() =>
  import("@/pages/admin/admin-comments").then((module) => ({
    default: module.AdminCommentsPage,
  }))
)
const AdminRatingsPage = lazy(() =>
  import("@/pages/admin/admin-ratings").then((module) => ({
    default: module.AdminRatingsPage,
  }))
)
const AdminAccessPage = lazy(() =>
  import("@/pages/admin/admin-access").then((module) => ({
    default: module.AdminAccessPage,
  }))
)
const AdminInvitesPage = lazy(() =>
  import("@/pages/admin/admin-invites").then((module) => ({
    default: module.AdminInvitesPage,
  }))
)
const AdminLogsPage = lazy(() =>
  import("@/pages/admin/admin-logs").then((module) => ({
    default: module.AdminLogsPage,
  }))
)

const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import("@tanstack/react-query-devtools").then((module) => ({
        default: module.ReactQueryDevtools,
      }))
    )
  : null

function RouteFallback() {
  return (
    <div className="min-h-[50vh] bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="h-36 animate-pulse rounded-lg border bg-card" />
          <div className="h-36 animate-pulse rounded-lg border bg-card" />
          <div className="h-36 animate-pulse rounded-lg border bg-card" />
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider storageKey="family-events-theme">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <AppErrorBoundary>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route index element={<MarketingPage />} />

                  <Route element={<PublicOnlyRoute />}>
                    <Route path="/sign-in" element={<SignInPage />} />
                    <Route path="/sign-up" element={<SignUpPage />} />
                  </Route>

                  <Route element={<ProtectedRoute />}>
                    <Route
                      element={
                        <AppProvider>
                          <AppLayout />
                        </AppProvider>
                      }
                    >
                      <Route path={HOME_PATH} element={<DashboardPage />} />
                      <Route path="/explore" element={<ExplorePage />} />
                      <Route path="/map" element={<MapViewPage />} />
                      <Route path="/events/:id" element={<EventDetailPage />} />
                      <Route path="/calendar" element={<CalendarViewPage />} />
                      <Route path="/saved" element={<MyEventsPage />} />
                      <Route path="/profile" element={<ProfilePage />} />
                    </Route>

                    <Route path="/admin" element={<AdminLayout />}>
                      <Route index element={<AdminDashboardPage />} />
                      <Route path="sources" element={<AdminSourcesPage />} />
                      <Route path="events" element={<AdminEventsPage />} />
                      <Route path="cities" element={<AdminCitiesPage />} />
                      <Route path="comments" element={<AdminCommentsPage />} />
                      <Route path="ratings" element={<AdminRatingsPage />} />
                      <Route path="access" element={<AdminAccessPage />} />
                      <Route path="invites" element={<AdminInvitesPage />} />
                      <Route path="logs" element={<AdminLogsPage />} />
                    </Route>
                  </Route>

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </AppErrorBoundary>
          </BrowserRouter>
          <Toaster richColors position="bottom-right" />
        </AuthProvider>
        {ReactQueryDevtools ? (
          <Suspense fallback={null}>
            <ReactQueryDevtools initialIsOpen={false} />
          </Suspense>
        ) : null}
      </QueryClientProvider>
    </ThemeProvider>
  )
}
