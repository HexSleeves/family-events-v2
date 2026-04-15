import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { ThemeProvider } from "@/components/theme-provider"
import { AppErrorBoundary } from "@/components/app-error-boundary"
import { AuthProvider } from "@/contexts/auth-context"
import { AppProvider } from "@/contexts/app-context"
import { Toaster } from "@/components/ui/sonner"
import { queryClient } from "@/lib/query-client"

import { AppLayout } from "@/layouts/app-layout"
import { AdminLayout } from "@/layouts/admin-layout"

import { DashboardPage } from "@/pages/dashboard"
import { ExplorePage } from "@/pages/explore"
import { EventDetailPage } from "@/pages/event-detail"
import { CalendarViewPage } from "@/pages/calendar-view"
import { MyEventsPage } from "@/pages/my-events"
import { ProfilePage } from "@/pages/profile"

import { SignInPage } from "@/pages/auth/sign-in"
import { SignUpPage } from "@/pages/auth/sign-up"

import { AdminDashboardPage } from "@/pages/admin/admin-dashboard"
import { AdminSourcesPage } from "@/pages/admin/admin-sources"
import { AdminEventsPage } from "@/pages/admin/admin-events"
import { AdminCitiesPage } from "@/pages/admin/admin-cities"
import { AdminCommentsPage } from "@/pages/admin/admin-comments"
import { AdminRatingsPage } from "@/pages/admin/admin-ratings"
import { AdminLogsPage } from "@/pages/admin/admin-logs"

export default function App() {
  return (
    <ThemeProvider storageKey="family-events-theme">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppProvider>
            <BrowserRouter>
              <AppErrorBoundary>
                <Routes>
                  <Route path="/sign-in" element={<SignInPage />} />
                  <Route path="/sign-up" element={<SignUpPage />} />

                  <Route element={<AppLayout />}>
                    <Route index element={<DashboardPage />} />
                    <Route path="/explore" element={<ExplorePage />} />
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
                    <Route path="logs" element={<AdminLogsPage />} />
                  </Route>

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </AppErrorBoundary>
            </BrowserRouter>
            <Toaster richColors position="bottom-right" />
          </AppProvider>
        </AuthProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
