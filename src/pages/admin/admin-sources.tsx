import { useMemo, useState } from "react"
import { AdminSourcesHeader, AdminSourcesList } from "@/components/admin/admin-sources-sections"
import { AdminCityFilterBar } from "@/components/admin/admin-city-filter-bar"
import { useAdminCities } from "@/hooks/admin/use-admin-cities"
import { useCityFilter } from "@/hooks/admin/use-city-filter"
import { UNASSIGNED_CITY_KEY } from "@/lib/group-by-city"
import {
  useAdminSources,
  useCreateAdminSource,
  useTriggerSourceScrape,
  useUpdateAdminSource,
} from "@/hooks/admin/use-admin-sources"
import { useAdminToast } from "@/hooks/use-admin-toast"
import { toast } from "sonner"

type SourceType = "website" | "ical" | "rss" | "manual"

export function AdminSourcesPage() {
  const { data: sources = [] } = useAdminSources()
  const { data: cities = [] } = useAdminCities()
  const createSource = useCreateAdminSource()
  const updateSource = useUpdateAdminSource()
  const triggerScrape = useTriggerSourceScrape()
  const { value: cityFilter, setValue: setCityFilter } = useCityFilter()
  const { toastError } = useAdminToast()

  const [scrapingSourceIds, setScrapingSourceIds] = useState<Set<string>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newSource, setNewSource] = useState({
    name: "",
    url: "",
    source_type: "website" as SourceType,
    city_id: "",
  })

  const cityCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const source of sources) {
      const key = source.city_id ?? UNASSIGNED_CITY_KEY
      counts[key] = (counts[key] ?? 0) + 1
    }
    return counts
  }, [sources])

  async function handleScrape(sourceId: string) {
    setScrapingSourceIds((prev) => new Set([...prev, sourceId]))
    try {
      await triggerScrape.mutateAsync({ sourceId })
      toast.success("Scrape started!", { description: "Ingestion run queued." })
    } catch (error) {
      toastError(error, "Failed to trigger scrape.")
    } finally {
      setScrapingSourceIds((prev) => {
        const next = new Set(prev)
        next.delete(sourceId)
        return next
      })
    }
  }

  async function handleToggleActive(sourceId: string, isActive: boolean) {
    try {
      await updateSource.mutateAsync({
        sourceId,
        updates: { is_active: !isActive },
      })
    } catch (error) {
      toastError(error, "Failed to update source.")
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
      toastError(error, "Failed to create source.")
    }
  }

  function openAddDialogForCity(cityId: string) {
    setNewSource((prev) => ({ ...prev, city_id: cityId }))
    setDialogOpen(true)
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
      <AdminCityFilterBar
        cities={cities}
        counts={cityCounts}
        total={sources.length}
        value={cityFilter}
        onChange={setCityFilter}
      />
      <AdminSourcesList
        sources={sources}
        cities={cities}
        cityFilter={cityFilter}
        scrapingSourceIds={scrapingSourceIds}
        onToggleActive={handleToggleActive}
        onScrape={handleScrape}
        onAddSourceForCity={openAddDialogForCity}
      />
    </div>
  )
}
