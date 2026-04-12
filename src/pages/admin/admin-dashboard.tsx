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

const STATS = [
  {
    label: "Total Events",
    value: "248",
    delta: "+12 this week",
    icon: Calendar,
    color: "text-primary",
  },
  {
    label: "Pending Review",
    value: "14",
    delta: "Needs attention",
    icon: Clock,
    color: "text-amber-600",
  },
  {
    label: "Active Sources",
    value: "8",
    delta: "2 with errors",
    icon: Database,
    color: "text-blue-600",
  },
  {
    label: "Published",
    value: "226",
    delta: "91% publish rate",
    icon: CheckCircle,
    color: "text-green-600",
  },
]

const INGESTION_DATA = [
  { day: "Mon", imported: 24, skipped: 4, errors: 1 },
  { day: "Tue", imported: 31, skipped: 6, errors: 0 },
  { day: "Wed", imported: 18, skipped: 3, errors: 2 },
  { day: "Thu", imported: 42, skipped: 8, errors: 1 },
  { day: "Fri", imported: 35, skipped: 5, errors: 0 },
  { day: "Sat", imported: 28, skipped: 4, errors: 1 },
  { day: "Sun", imported: 19, skipped: 2, errors: 0 },
]

const chartConfig: ChartConfig = {
  imported: { label: "Imported", color: "var(--chart-1)" },
  skipped: { label: "Skipped", color: "var(--chart-4)" },
  errors: { label: "Errors", color: "var(--chart-5)" },
}

const RECENT_RUNS = [
  { source: "NYC Parks Events", status: "success", imported: 12, time: "2 hours ago" },
  { source: "Eventbrite Family", status: "success", imported: 8, time: "4 hours ago" },
  { source: "Brooklyn Library", status: "error", imported: 0, time: "6 hours ago" },
  { source: "Museum Kids Feed", status: "partial", imported: 5, time: "8 hours ago" },
]

export function AdminDashboardPage() {
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
        {STATS.map((stat) => (
          <Card key={stat.label} className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
              <p className="text-2xl font-extrabold text-foreground">{stat.value}</p>
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
              { label: "High confidence (>0.9)", value: 68, color: "bg-green-500" },
              { label: "Medium (0.7-0.9)", value: 22, color: "bg-amber-500" },
              { label: "Low (<0.7)", value: 10, color: "bg-destructive" },
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
              226 of 248 events auto-tagged. 14 flagged for manual review.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
