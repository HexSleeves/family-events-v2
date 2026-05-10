import { useQuery } from "@tanstack/react-query"
import { qk } from "@/lib/query-keys"
import { supabase } from "@/lib/supabase"
import type { AdminSourceRun } from "./admin-types"

export function useAdminSourceRuns() {
  return useQuery({
    queryKey: qk.admin.sourceRuns,
    queryFn: async (): Promise<AdminSourceRun[]> => {
      const { data, error } = await supabase
        .from("source_runs")
        .select(
          "id, source_id, started_at, completed_at, status, events_found, events_imported, events_skipped, error_log, created_at, event_sources(name)"
        )
        .order("started_at", { ascending: false })
        .limit(50)

      if (error) {
        throw error
      }
      return (data ?? []) as AdminSourceRun[]
    },
    refetchInterval: (query) =>
      query.state.data?.some((run) => run.status === "running") ? 3000 : false,
  })
}
