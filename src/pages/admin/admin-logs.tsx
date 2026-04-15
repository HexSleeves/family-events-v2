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
import { useAdminSourceRuns } from "@/hooks/admin/use-admin-data"

type RunStatus = "success" | "error" | "partial" | "running"

const STATUS_CONFIG: Record<RunStatus, { icon: React.ElementType; color: string; label: string }> =
  {
    success: { icon: CheckCircle, color: "text-green-600", label: "Success" },
    error: { icon: XCircle, color: "text-destructive", label: "Error" },
    partial: { icon: AlertTriangle, color: "text-amber-500", label: "Partial" },
    running: { icon: RefreshCw, color: "text-blue-600", label: "Running" },
  }

export function AdminLogsPage() {
  const { data: logs = [] } = useAdminSourceRuns()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-foreground">Ingestion Logs</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Scrape run history and diagnostics</p>
      </div>

      <div className="space-y-3">
        {logs.map((run) => {
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
                      <h3 className="font-semibold text-sm text-foreground">
                        {run.event_sources?.name || "Unknown source"}
                      </h3>
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
