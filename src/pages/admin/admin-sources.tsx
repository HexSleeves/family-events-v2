import { useState } from "react"
import { AdminSourcesHeader, AdminSourcesList } from "@/components/admin/admin-sources-sections"
import { useAdminCities } from "@/hooks/admin/use-admin-cities"
import {
  useAdminSources,
  useCreateAdminSource,
  useTriggerSourceScrape,
  useUpdateAdminSource,
} from "@/hooks/admin/use-admin-sources"
import { humanizeSupabaseError } from "@/lib/humanize-supabase-error"
import { toast } from "sonner"

type SourceType = "website" | "ical" | "rss" | "manual"

export function AdminSourcesPage() {
  const { data: sources = [] } = useAdminSources()
  const { data: cities = [] } = useAdminCities()
  const createSource = useCreateAdminSource()
  const updateSource = useUpdateAdminSource()
  const triggerScrape = useTriggerSourceScrape()

  const [scrapingSourceId, setScrapingSourceId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newSource, setNewSource] = useState({
    name: "",
    url: "",
    source_type: "website" as SourceType,
    city_id: "",
  })

  async function handleScrape(sourceId: string) {
    setScrapingSourceId(sourceId)
    try {
      await triggerScrape.mutateAsync({ sourceId })
      toast.success("Scrape started!", { description: "Ingestion run queued." })
    } catch (error) {
      toast.error(humanizeSupabaseError(error, "Failed to trigger scrape."))
    } finally {
      setScrapingSourceId(null)
    }
  }

  async function handleToggleActive(sourceId: string, isActive: boolean) {
    try {
      await updateSource.mutateAsync({
        sourceId,
        updates: { is_active: !isActive },
      })
    } catch (error) {
      toast.error(humanizeSupabaseError(error, "Failed to update source."))
    }
  }

  async function handleAddSource() {
    if (!newSource.name || !newSource.url) {
      toast.error("Name and URL are required")
      return
    }

    try {
      await createSource.mutateAsync({
        name: newSource.name,
        url: newSource.url,
        source_type: newSource.source_type,
        city_id: newSource.city_id || null,
        is_active: true,
        scrape_interval_hours: 24,
        last_scraped_at: null,
        last_status: "pending",
        error_count: 0,
        notes: null,
      })
      setDialogOpen(false)
      setNewSource({ name: "", url: "", source_type: "website", city_id: "" })
      toast.success("Source added!", { description: "Trigger a scrape to import events." })
    } catch (error) {
      toast.error(humanizeSupabaseError(error, "Failed to create source."))
    }
  }

  return (
    <div className="space-y-6">
      <AdminSourcesHeader
        activeSourceCount={sources.filter((source) => source.is_active).length}
        cities={cities}
        dialogOpen={dialogOpen}
        newSource={newSource}
        onDialogOpenChange={setDialogOpen}
        onNameChange={(value) => setNewSource((prev) => ({ ...prev, name: value }))}
        onUrlChange={(value) => setNewSource((prev) => ({ ...prev, url: value }))}
        onTypeChange={(value) => setNewSource((prev) => ({ ...prev, source_type: value }))}
        onCityChange={(value) => setNewSource((prev) => ({ ...prev, city_id: value }))}
        onAddSource={handleAddSource}
      />
      <AdminSourcesList
        sources={sources}
        cities={cities}
        scrapingSourceId={scrapingSourceId}
        onToggleActive={handleToggleActive}
        onScrape={handleScrape}
      />
    </div>
  )
}
