import { useEffect, useMemo, useRef } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PlanHeroCard } from "@/components/plan/plan-hero-card"
import { PlanThumbCard } from "@/components/plan/plan-thumb-card"
import { WeatherStrip } from "@/components/plan/weather-strip"
import { useAuth } from "@/stores/auth-store"
import { useApp } from "@/contexts/app-context"
import { usePlanForToday } from "@/hooks/use-plan-for-today"
import { humanizeSupabaseError } from "@/lib/humanize-supabase-error"
import { toast } from "sonner"

function planExploreHref(date: string | null, weatherFit: string): string {
  const params = new URLSearchParams()
  if (date) {
    params.set("date", date)
  }
  params.set("dist", "15")
  if (weatherFit !== "any") {
    params.set("fit", weatherFit)
  }
  const query = params.toString()
  return query ? `/explore?${query}` : "/explore"
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="h-6 w-44 animate-pulse rounded bg-muted" />
      <div className="h-80 animate-pulse rounded-xl bg-muted" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-56 animate-pulse rounded-xl bg-muted" />
        <div className="h-56 animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  )
}

export function SaturdayPlanPage() {
  const { user, profile } = useAuth()
  const { selectedCity } = useApp()
  const errorToastRef = useRef(false)

  const {
    data: plan,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = usePlanForToday({
    userId: user?.id,
    selectedCity,
    childAge: profile?.child_age ?? null,
  })

  useEffect(() => {
    if (!isError) {
      errorToastRef.current = false
      return
    }
    if (errorToastRef.current) {
      return
    }
    errorToastRef.current = true
    toast.error("We couldn't load today's plan.", {
      description: humanizeSupabaseError(error, "Tap retry to try again."),
    })
  }, [error, isError])

  const exploreHref = useMemo(
    () => planExploreHref(plan?.date ?? null, plan?.weatherFit ?? "any"),
    [plan?.date, plan?.weatherFit]
  )

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Saturday Plan</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          {profile?.child_name
            ? `Ready for ${profile.child_name}'s next adventure?`
            : "Ready for your next family adventure?"}
        </h1>
        <WeatherStrip
          date={plan?.date ?? null}
          cityName={selectedCity?.name}
          weather={plan?.weather ?? null}
        />
      </div>

      {isLoading ? <LoadingState /> : null}

      {isError ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="space-y-3 p-4">
            <p className="text-sm text-destructive">
              We couldn't load your Saturday plan right now.
            </p>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                void refetch()
              }}
            >
              <RefreshCw className="h-4 w-4" />
              {isRefetching ? "Retrying..." : "Retry"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !isError && plan ? (
        <>
          {plan.fallbackMessage ? (
            <Card className="border-border/60">
              <CardContent className="p-3 text-sm text-muted-foreground">
                {plan.fallbackMessage}
              </CardContent>
            </Card>
          ) : null}

          {plan.heroEvent ? (
            <PlanHeroCard event={plan.heroEvent} />
          ) : (
            <Card className="border-border/60">
              <CardContent className="space-y-3 p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No family plans found nearby this week.
                </p>
                <Button asChild>
                  <Link to="/explore">Explore events</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {plan.secondaryEvents.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {plan.secondaryEvents.map((event) => (
                <PlanThumbCard key={event.id} event={event} />
              ))}
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button variant="ghost" className="gap-1 text-primary" asChild>
              <Link to={exploreHref}>
                See more options
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </>
      ) : null}
    </div>
  )
}
