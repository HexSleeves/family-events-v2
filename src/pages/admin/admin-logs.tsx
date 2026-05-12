import { useEffect, useState } from "react"
import { format } from "date-fns"
import {
  CircleCheck as CheckCircle,
  Circle as XCircle,
  TriangleAlert as AlertTriangle,
  RefreshCw,
  Clock,
  TimerOff,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useAdminSourceRuns } from "@/hooks/admin/use-admin-source-runs"

type RunStatus = "success" | "error" | "partial" | "running" | "timed_out"

const STALE_THRESHOLD_MS = 15 * 60 * 1000

const STATUS_CONFIG: Record<RunStatus, { icon: React.ElementType; color: string; label: string }> =
  {
    success: { icon: CheckCircle, color: "text-green-600", label: "Success" },
    error: { icon: XCircle, color: "text-destructive", label: "Error" },
    partial: { icon: AlertTriangle, color: "text-amber-500", label: "Partial" },
    running: { icon: RefreshCw, color: "text-blue-600", label: "Running" },
    timed_out: { icon: TimerOff, color: "text-amber-500", label: "Timed Out" },
  }

function isRunStatus(status: string): status is RunStatus {
  return status in STATUS_CONFIG
}

function resolveStatus(status: string, startedAt: string): RunStatus {
  const normalized: RunStatus = isRunStatus(status) ? status : "error"
  if (normalized !== "running") return normalized
  const elapsed = Date.now() - new Date(startedAt).getTime()
  return elapsed > STALE_THRESHOLD_MS ? "timed_out" : "running"
}

function ElapsedTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const start = new Date(startedAt).getTime()
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt])

  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  return <span className="tabular-nums">{mins > 0 ? `${mins}m ${secs}s` : `${secs}s`} elapsed</span>
}

export function AdminLogsPage() {
  const { data: logs = [] } = useAdminSourceRuns()
  const hasRunning = logs.some((r) => resolveStatus(r.status, r.started_at) === "running")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-foreground">Ingestion Logs</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Scrape run history and diagnostics</p>
        </div>
        {hasRunning && (
          <div className="flex items-center gap-1.5 text-xs text-blue-600">
            <RefreshCw className="h-3 w-3 animate-spin" />
            <span>Live</span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {logs.map((run) => {
          const resolvedStatus = resolveStatus(run.status, run.started_at)
          const status = STATUS_CONFIG[resolvedStatus]
          const isRunning = resolvedStatus === "running"
          const isTimedOut = resolvedStatus === "timed_out"
          const duration =
            !isRunning && run.completed_at
              ? Math.round(
                  (new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000
                )
              : isTimedOut
                ? Math.round((Date.now() - new Date(run.started_at).getTime()) / 1000)
                : null

          return (
            <Card
              key={run.id}
              className={cn(
                "border-border/60",
                isRunning && "border-blue-500/30 bg-blue-500/5",
                isTimedOut && "border-amber-500/30 bg-amber-500/5"
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={cn("mt-0.5 shrink-0", status.color)}>
                    <status.icon className={cn("h-5 w-5", isRunning && "animate-spin")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm text-foreground">
                        {run.event_sources?.name || "Unknown source"}
                      </h3>
                      <Badge
                        variant={
                          resolvedStatus === "success"
                            ? "secondary"
                            : resolvedStatus === "error" || resolvedStatus === "timed_out"
                              ? "destructive"
                              : "outline"
                        }
                        className={cn(
                          "text-[10px]",
                          isRunning && "border-blue-500/40 text-blue-600",
                          isTimedOut && "border-amber-500/40 text-amber-600"
                        )}
                      >
                        {status.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(run.started_at), "MMM d, h:mm a")}
                      </span>
                      {isRunning ? (
                        <ElapsedTimer startedAt={run.started_at} />
                      ) : (
                        duration !== null && (
                          <span>
                            {duration >= 60
                              ? `${Math.floor(duration / 60)}m ${duration % 60}s`
                              : `${duration}s`}{" "}
                            {isTimedOut ? "before timeout" : "duration"}
                          </span>
                        )
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-xs flex-wrap">
                      <span
                        className={cn(
                          "font-medium",
                          run.events_imported > 0 ? "text-green-600" : "text-muted-foreground"
                        )}
                      >
                        +{run.events_imported} imported
                      </span>
                      <span className="text-muted-foreground">{run.events_skipped} skipped</span>
                      <span className="text-muted-foreground">
                        {run.events_found > 0
                          ? `${run.events_found} found`
                          : isRunning
                            ? "fetching…"
                            : "0 found"}
                      </span>
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
