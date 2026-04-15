import {
  ChartBar as BarChart3,
  Calendar,
  Database,
  TriangleAlert as AlertTriangle,
  CircleCheck as CheckCircle,
  Clock,
  Circle as XCircle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts"
import type { ChartConfig } from "@/components/ui/chart"
import { useAdminSourceRuns, useAdminStats } from "@/hooks/admin/use-admin-data"

const chartConfig: ChartConfig = {
  imported: { label: "Imported", color: "var(--chart-1)" },
  skipped: { label: "Skipped", color: "var(--chart-4)" },
  errors: { label: "Errors", color: "var(--chart-5)" },
}

export function AdminDashboardPage() {
  const { data: stats, isLoading: isStatsLoading } = useAdminStats()
  const { data: runs = [], isLoading: isRunsLoading } = useAdminSourceRuns()

  const STAT_CARDS = [
    {
      label: "Total Events",
      value: stats?.totalEvents ?? 0,
      delta: "Across all statuses",
      icon: Calendar,
      color: "text-primary",
    },
    {
      label: "Pending Review",
      value: stats?.pendingReview ?? 0,
      delta: "Needs attention",
      icon: Clock,
      color: "text-amber-600",
    },
    {
      label: "Active Sources",
      value: stats?.activeSources ?? 0,
      delta: `${stats?.sourceErrors ?? 0} with errors`,
      icon: Database,
      color: "text-blue-600",
    },
    {
      label: "Published",
      value: stats?.published ?? 0,
      delta: stats?.totalEvents
        ? `${Math.round((stats.published / stats.totalEvents) * 100)}% publish rate`
        : "No events yet",
      icon: CheckCircle,
      color: "text-green-600",
    },
  ]

  const byDay = new Map<string, { imported: number; skipped: number; errors: number }>()
  for (const run of runs) {
    const day = new Date(run.started_at).toLocaleDateString("en-US", { weekday: "short" })
    const current = byDay.get(day) ?? { imported: 0, skipped: 0, errors: 0 }
    current.imported += run.events_imported
    current.skipped += run.events_skipped
    current.errors += run.status === "error" ? 1 : 0
    byDay.set(day, current)
  }

  const INGESTION_DATA = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => ({
    day,
    imported: byDay.get(day)?.imported ?? 0,
    skipped: byDay.get(day)?.skipped ?? 0,
    errors: byDay.get(day)?.errors ?? 0,
  }))

  const RECENT_RUNS = runs.slice(0, 4).map((run) => ({
    source: run.event_sources?.name || "Unknown source",
    status: run.status,
    imported: run.events_imported,
    time: new Date(run.started_at).toLocaleString(),
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Overview of your Family Events platform
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map((stat) => (
          <Card key={stat.label} className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
              <p className="text-2xl font-extrabold text-foreground">
                {isStatsLoading ? "..." : stat.value}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{stat.delta}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Ingestion chart */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Event Ingestion (Last 7 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
            <BarChart accessibilityLayer data={INGESTION_DATA}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="imported" fill="var(--color-imported)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="skipped" fill="var(--color-skipped)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="errors" fill="var(--color-errors)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Recent runs + AI confidence */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Recent Ingestion Runs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!isRunsLoading && RECENT_RUNS.length === 0 && (
              <p className="text-sm text-muted-foreground">No ingestion runs yet.</p>
            )}
            {RECENT_RUNS.map((run) => (
              <div key={run.source} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {run.status === "success" && (
                    <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                  )}
                  {run.status === "error" && (
                    <XCircle className="h-4 w-4 text-destructive shrink-0" />
                  )}
                  {run.status === "partial" && (
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{run.source}</p>
                    <p className="text-xs text-muted-foreground">{run.time}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <Badge
                    variant={
                      run.status === "success"
                        ? "secondary"
                        : run.status === "error"
                          ? "destructive"
                          : "outline"
                    }
                    className="text-[10px]"
                  >
                    {run.status}
                  </Badge>
                  {run.imported > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">+{run.imported} events</p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">AI Tagging Confidence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              {
                label: "High confidence (>0.9)",
                value: stats?.aiBuckets.high ?? 0,
                color: "bg-green-500",
              },
              {
                label: "Medium (0.7-0.9)",
                value: stats?.aiBuckets.medium ?? 0,
                color: "bg-amber-500",
              },
              {
                label: "Low (<0.7)",
                value: stats?.aiBuckets.low ?? 0,
                color: "bg-destructive",
              },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-semibold">{item.value}%</span>
                </div>
                <Progress value={item.value} className="h-2" />
              </div>
            ))}
            <p className="text-xs text-muted-foreground pt-2">
              {stats?.published ?? 0} published events, {stats?.pendingReview ?? 0} pending review.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
