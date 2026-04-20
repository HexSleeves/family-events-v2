import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { AdminSourceRun } from "./admin-types"

export function useAdminSourceRuns() {
  return useQuery({
    queryKey: ["admin", "source-runs"],
    queryFn: async (): Promise<AdminSourceRun[]> => {
      const { data, error } = await supabase
        .from("source_runs")
        .select("*, event_sources(name)")
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
