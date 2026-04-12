import { format } from "date-fns"
import {
  CircleCheck as CheckCircle,
  Circle as XCircle,
  TriangleAlert as AlertTriangle,
  RefreshCw,
  Clock,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const MOCK_LOGS = [
  {
    id: "r1",
    source: "NYC Parks Family Events",
    status: "success",
    started_at: new Date(Date.now() - 7200000).toISOString(),
    completed_at: new Date(Date.now() - 7100000).toISOString(),
    events_found: 18,
    events_imported: 12,
    events_skipped: 6,
    error_log: null,
  },
  {
    id: "r2",
    source: "Eventbrite Family NYC",
    status: "success",
    started_at: new Date(Date.now() - 14400000).toISOString(),
    completed_at: new Date(Date.now() - 14300000).toISOString(),
    events_found: 34,
    events_imported: 28,
    events_skipped: 6,
    error_log: null,
  },
  {
    id: "r3",
    source: "Brooklyn Public Library",
    status: "error",
    started_at: new Date(Date.now() - 21600000).toISOString(),
    completed_at: new Date(Date.now() - 21550000).toISOString(),
    events_found: 0,
    events_imported: 0,
    events_skipped: 0,
    error_log:
      "Connection timeout: Unable to reach https://www.bklynlibrary.org/events after 3 retries. SSL certificate error.",
  },
  {
    id: "r4",
    source: "Museum of Natural History Kids",
    status: "partial",
    started_at: new Date(Date.now() - 43200000).toISOString(),
    completed_at: new Date(Date.now() - 43100000).toISOString(),
    events_found: 15,
    events_imported: 8,
    events_skipped: 7,
    error_log: "7 events skipped due to missing required fields (start_datetime)",
  },
  {
    id: "r5",
    source: "NYC Parks Family Events",
    status: "success",
    started_at: new Date(Date.now() - 86400000).toISOString(),
    completed_at: new Date(Date.now() - 86300000).toISOString(),
    events_found: 22,
    events_imported: 18,
    events_skipped: 4,
    error_log: null,
  },
  {
    id: "r6",
    source: "Eventbrite Family NYC",
    status: "success",
    started_at: new Date(Date.now() - 90000000).toISOString(),
    completed_at: new Date(Date.now() - 89900000).toISOString(),
    events_found: 41,
    events_imported: 35,
    events_skipped: 6,
    error_log: null,
  },
]

type RunStatus = "success" | "error" | "partial" | "running"

const STATUS_CONFIG: Record<RunStatus, { icon: React.ElementType; color: string; label: string }> =
  {
    success: { icon: CheckCircle, color: "text-green-600", label: "Success" },
    error: { icon: XCircle, color: "text-destructive", label: "Error" },
    partial: { icon: AlertTriangle, color: "text-amber-500", label: "Partial" },
    running: { icon: RefreshCw, color: "text-blue-600", label: "Running" },
  }

export function AdminLogsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-foreground">Ingestion Logs</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Scrape run history and diagnostics</p>
      </div>

      <div className="space-y-3">
        {MOCK_LOGS.map((run) => {
          const status = STATUS_CONFIG[run.status as RunStatus]
          const duration = run.completed_at
            ? Math.round(
                (new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000
              )
            : null

          return (
            <Card key={run.id} className="border-border/60">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={cn("mt-0.5 shrink-0", status.color)}>
                    <status.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm text-foreground">{run.source}</h3>
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
                        {status.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(run.started_at), "MMM d, h:mm a")}
                      </span>
                      {duration !== null && <span>{duration}s duration</span>}
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-xs flex-wrap">
                      <span className="text-green-600 font-medium">
                        +{run.events_imported} imported
                      </span>
                      <span className="text-muted-foreground">{run.events_skipped} skipped</span>
                      <span className="text-muted-foreground">{run.events_found} found</span>
                    </div>
                    {run.error_log && (
                      <div className="mt-2 rounded-lg bg-destructive/5 border border-destructive/20 p-2">
                        <p className="text-xs text-destructive font-mono leading-relaxed">
                          {run.error_log}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
