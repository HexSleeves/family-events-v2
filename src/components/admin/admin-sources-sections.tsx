import {
  Calendar,
  Circle as XCircle,
  CircleCheck as CheckCircle,
  Clock,
  FileText,
  Globe,
  Plus,
  RefreshCw,
  Rss,
  TriangleAlert as AlertTriangle,
} from "lucide-react"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { City, EventSource } from "@/lib/types"

type SourceType = "website" | "ical" | "rss" | "manual"
type SourceStatus = "pending" | "success" | "error" | "partial"

const SOURCE_TYPE_ICONS: Record<SourceType, ElementType> = {
  website: Globe,
  rss: Rss,
  ical: Calendar,
  manual: FileText,
}

function StatusIndicator({ status }: { status: SourceStatus }) {
  const config = {
    success: { icon: CheckCircle, color: "text-green-600", label: "Healthy" },
    error: { icon: XCircle, color: "text-destructive", label: "Error" },
    partial: { icon: AlertTriangle, color: "text-amber-500", label: "Partial" },
    pending: { icon: Clock, color: "text-muted-foreground", label: "Pending" },
  }[status]

  return (
    <div className={`flex items-center gap-1 ${config.color}`}>
      <config.icon className="h-3.5 w-3.5" />
      <span className="text-xs font-medium">{config.label}</span>
    </div>
  )
}

interface AdminSourcesHeaderProps {
  activeSourceCount: number
  cities: City[]
  dialogOpen: boolean
  newSource: {
    name: string
    url: string
    source_type: SourceType
    city_id: string
  }
  onDialogOpenChange: (open: boolean) => void
  onNameChange: (value: string) => void
  onUrlChange: (value: string) => void
  onTypeChange: (value: SourceType) => void
  onCityChange: (value: string) => void
  onAddSource: () => void
}

export function AdminSourcesHeader({
  activeSourceCount,
  cities,
  dialogOpen,
  newSource,
  onDialogOpenChange,
  onNameChange,
  onUrlChange,
  onTypeChange,
  onCityChange,
  onAddSource,
}: AdminSourcesHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-xl font-extrabold text-foreground">Event Sources</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{activeSourceCount} active sources</p>
      </div>
      <Dialog open={dialogOpen} onOpenChange={onDialogOpenChange}>
        <DialogTrigger asChild>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Source
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Event Source</DialogTitle>
            <DialogDescription>
              Create a source, then trigger a scrape to import events into the review queue.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Source Name</Label>
              <Input
                value={newSource.name}
                onChange={(event) => onNameChange(event.target.value)}
                placeholder="e.g. NYC Parks Family Events"
              />
            </div>
            <div className="space-y-1.5">
              <Label>URL</Label>
              <Input
                value={newSource.url}
                onChange={(event) => onUrlChange(event.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={newSource.source_type} onValueChange={(value) => onTypeChange(value as SourceType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="ical">iCal Feed</SelectItem>
                    <SelectItem value="rss">RSS Feed</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>City</Label>
                <Select value={newSource.city_id} onValueChange={onCityChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select city" />
                  </SelectTrigger>
                  <SelectContent>
                    {cities.map((city) => (
                      <SelectItem key={city.id} value={city.id}>
                        {city.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onDialogOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={onAddSource}>Add Source</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface AdminSourcesListProps {
  sources: EventSource[]
  cities: City[]
  scrapingSourceId: string | null
  onToggleActive: (sourceId: string, isActive: boolean) => void
  onScrape: (sourceId: string) => void
}

export function AdminSourcesList({
  sources,
  cities,
  scrapingSourceId,
  onToggleActive,
  onScrape,
}: AdminSourcesListProps) {
  return (
    <div className="space-y-3">
      {sources.map((source) => {
        const TypeIcon = SOURCE_TYPE_ICONS[source.source_type as SourceType]
        const cityLabel = cities.find((city) => city.id === source.city_id)?.name ?? "All cities"

        return (
          <Card key={source.id} className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <TypeIcon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm text-foreground">{source.name}</h3>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {source.source_type}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{cityLabel}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{source.url}</p>
                  <div className="flex items-center gap-4 mt-2 flex-wrap">
                    <StatusIndicator status={(source.last_status ?? "pending") as SourceStatus} />
                    {source.last_scraped_at && (
                      <span className="text-xs text-muted-foreground">
                        Last run {format(new Date(source.last_scraped_at), "MMM d, h:mm a")}
                      </span>
                    )}
                    {source.error_count > 0 && (
                      <span className="text-xs text-destructive">{source.error_count} errors</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Switch
                    checked={source.is_active}
                    onCheckedChange={() => onToggleActive(source.id, source.is_active)}
                    aria-label="Active"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs h-8"
                    disabled={scrapingSourceId !== null || !source.is_active}
                    onClick={() => onScrape(source.id)}
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${scrapingSourceId === source.id ? "animate-spin" : ""}`}
                    />
                    {scrapingSourceId === source.id ? "Running..." : "Scrape Now"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
import type { ElementType } from "react"
