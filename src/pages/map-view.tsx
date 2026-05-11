import { useEffect, useMemo } from "react"
import { Link } from "react-router-dom"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { format } from "date-fns"
import { MapPin } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/stores/auth-store"
import { useApp } from "@/contexts/app-context"
import { useEnrichedEvents } from "@/hooks/use-enriched-events"
import type { EventWithDetails } from "@/lib/types"

// Default Leaflet marker icons bundle as-is via Vite — re-wire so pins render.
// Without this, marker images 404 because Vite doesn't resolve the CSS-relative paths.
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})
L.Marker.prototype.options.icon = DefaultIcon

// Recenter map when selected city changes.
function RecenterOnCity({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lng], map.getZoom() < 11 ? 11 : map.getZoom())
  }, [lat, lng, map])
  return null
}

function hasCoords(
  e: EventWithDetails
): e is EventWithDetails & { latitude: number; longitude: number } {
  return typeof e.latitude === "number" && typeof e.longitude === "number"
}

export function MapViewPage() {
  const { user } = useAuth()
  const { selectedCity } = useApp()
  const { data: events = [], isLoading } = useEnrichedEvents({
    cityId: selectedCity?.id,
    userId: user?.id,
  })

  const mappable = useMemo(() => events.filter(hasCoords), [events])

  // Fallback to Boston if the city has no coords yet (shouldn't happen with seed data).
  const centerLat = selectedCity?.latitude ?? 42.3601
  const centerLng = selectedCity?.longitude ?? -71.0589

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-foreground">Map</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isLoading
              ? "Loading events..."
              : mappable.length > 0
                ? `${mappable.length} event${mappable.length === 1 ? "" : "s"} in ${selectedCity?.name ?? "your area"}`
                : `No mapped events in ${selectedCity?.name ?? "your area"} yet`}
          </p>
        </div>
        {events.length > mappable.length && (
          <Badge variant="outline" className="text-xs">
            {events.length - mappable.length} missing coordinates
          </Badge>
        )}
      </div>

      {mappable.length === 0 && !isLoading ? (
        <Card className="border-border/60">
          <CardContent className="p-8 text-center space-y-3">
            <MapPin className="h-8 w-8 mx-auto text-muted-foreground" />
            <h2 className="text-lg font-bold">No events with locations yet</h2>
            <p className="text-sm text-muted-foreground">
              Published events need latitude + longitude to appear on the map. Try a different city
              or switch to the explore view.
            </p>
            <Button asChild>
              <Link to="/explore">Browse Explore</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-2xl overflow-hidden border border-border/60 h-[70vh] min-h-[400px]">
          <MapContainer
            center={[centerLat, centerLng]}
            zoom={11}
            scrollWheelZoom={true}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              subdomains="abcd"
              maxZoom={19}
            />
            <RecenterOnCity lat={centerLat} lng={centerLng} />
            {mappable.map((event) => (
              <Marker key={event.id} position={[event.latitude, event.longitude]}>
                <Popup>
                  <div className="space-y-1 min-w-[200px]">
                    <Link
                      to={`/events/${event.id}`}
                      className="font-semibold text-sm text-foreground hover:text-primary block leading-tight"
                    >
                      {event.title}
                    </Link>
                    {event.venue_name && (
                      <p className="text-xs text-muted-foreground">{event.venue_name}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(event.start_datetime), "MMM d, h:mm a")}
                    </p>
                    <div className="flex gap-1 flex-wrap pt-1">
                      {event.is_free && (
                        <Badge variant="secondary" className="text-[10px]">
                          Free
                        </Badge>
                      )}
                      {event.age_min !== null && event.age_max !== null && (
                        <Badge variant="outline" className="text-[10px]">
                          Ages {event.age_min}–{event.age_max}
                        </Badge>
                      )}
                    </div>
                    <Button asChild size="sm" className="w-full h-7 text-xs mt-1">
                      <Link to={`/events/${event.id}`}>View Details</Link>
                    </Button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}
    </div>
  )
}
