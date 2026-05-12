import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { Map as MapGL, Marker, NavigationControl, Popup, type MapRef } from "react-map-gl/maplibre"
import "maplibre-gl/dist/maplibre-gl.css"
import { format } from "date-fns"
import { MapPin } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/features/auth/stores/auth-store"
import { useApp } from "@/app/stores/app-store"
import { useEnrichedEvents } from "@/features/events/hooks/use-enriched-events"
import { useMapStyle } from "@/hooks/use-map-style"
import { FadeSwap } from "@/components/motion"
import { Skeleton } from "@/components/ui/skeleton"
import type { EventWithDetails } from "@/lib/types"

function hasCoords(
  e: EventWithDetails
): e is EventWithDetails & { latitude: number; longitude: number } {
  return typeof e.latitude === "number" && typeof e.longitude === "number"
}

function EventPin() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 36"
      width={28}
      height={36}
      className="drop-shadow"
    >
      <path
        d="M14 0C6.27 0 0 6.27 0 14c0 9.94 14 22 14 22S28 23.94 28 14C28 6.27 21.73 0 14 0z"
        fill="oklch(0.54 0.215 12)"
      />
      <circle cx={14} cy={14} r={5.5} fill="white" />
    </svg>
  )
}

export function MapViewPage() {
  const { user } = useAuth()
  const { selectedCity, isCitiesLoading } = useApp()
  const mapStyle = useMapStyle()
  const mapRef = useRef<MapRef>(null)
  const [popupEvent, setPopupEvent] = useState<
    (EventWithDetails & { latitude: number; longitude: number }) | null
  >(null)

  const { data: events = [], isLoading: isEventsLoading } = useEnrichedEvents({
    cityId: selectedCity?.id,
    userId: user?.id,
    enabled: Boolean(selectedCity?.id),
  })

  const mappable = useMemo(() => events.filter(hasCoords), [events])

  const centerLat = selectedCity?.latitude
  const centerLng = selectedCity?.longitude

  // Fly to the new city center smoothly when it changes.
  useEffect(() => {
    if (centerLat == null || centerLng == null) return
    const map = mapRef.current
    if (!map) return
    map.flyTo({ center: [centerLng, centerLat], zoom: 11, speed: 1.2, essential: true })
  }, [centerLat, centerLng])

  const bodyKey =
    !selectedCity || centerLat == null || centerLng == null
      ? "map-city-loading"
      : isEventsLoading
        ? "map-events-loading"
        : mappable.length === 0
          ? "map-empty"
          : "map-content"

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-foreground">Map</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {!selectedCity || isCitiesLoading
              ? "Loading your city..."
              : isEventsLoading
                ? "Loading events..."
                : mappable.length > 0
                  ? `${mappable.length} event${mappable.length === 1 ? "" : "s"} in ${selectedCity.name}`
                  : `No mapped events in ${selectedCity.name} yet`}
          </p>
        </div>
        {events.length > mappable.length && (
          <Badge variant="outline" className="text-xs">
            {events.length - mappable.length} missing coordinates
          </Badge>
        )}
      </div>

      <FadeSwap stateKey={bodyKey}>
        {bodyKey === "map-city-loading" ? (
          <Skeleton className="w-full h-[70vh] min-h-[400px] rounded-2xl" />
        ) : bodyKey === "map-empty" ? (
          <Card className="border-border/60">
            <CardContent className="p-8 text-center space-y-3">
              <MapPin className="h-8 w-8 mx-auto text-muted-foreground" />
              <h2 className="text-lg font-bold">No events with locations yet</h2>
              <p className="text-sm text-muted-foreground">
                Published events need latitude + longitude to appear on the map. Try a different
                city or switch to the explore view.
              </p>
              <Button asChild>
                <Link to="/explore">Browse Explore</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-2xl overflow-hidden border border-border/60 h-[70vh] min-h-[400px]">
            <MapGL
              ref={mapRef}
              initialViewState={{ longitude: centerLng!, latitude: centerLat!, zoom: 11 }}
              mapStyle={mapStyle}
              style={{ width: "100%", height: "100%" }}
              attributionControl={{ compact: true }}
            >
              <NavigationControl position="top-left" showCompass={false} />
              {mappable.map((event) => (
                <Marker
                  key={event.id}
                  longitude={event.longitude}
                  latitude={event.latitude}
                  anchor="bottom"
                  onClick={(e) => {
                    e.originalEvent.stopPropagation()
                    setPopupEvent(event)
                  }}
                >
                  <button
                    type="button"
                    aria-label={event.title}
                    className="block transition-transform hover:scale-110 active:scale-95"
                  >
                    <EventPin />
                  </button>
                </Marker>
              ))}
              {popupEvent && (
                <Popup
                  longitude={popupEvent.longitude}
                  latitude={popupEvent.latitude}
                  anchor="bottom"
                  offset={36}
                  closeButton
                  closeOnClick
                  onClose={() => setPopupEvent(null)}
                  maxWidth="280px"
                >
                  <div className="space-y-1.5 min-w-[200px]">
                    <Link
                      to={`/events/${popupEvent.id}`}
                      className="font-semibold text-sm text-foreground hover:text-primary block leading-tight"
                    >
                      {popupEvent.title}
                    </Link>
                    {popupEvent.venue_name && (
                      <p className="text-xs text-muted-foreground">{popupEvent.venue_name}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(popupEvent.start_datetime), "MMM d, h:mm a")}
                    </p>
                    <div className="flex gap-1 flex-wrap pt-1">
                      {popupEvent.is_free && (
                        <Badge variant="secondary" className="text-[10px]">
                          Free
                        </Badge>
                      )}
                      {popupEvent.age_min !== null && popupEvent.age_max !== null && (
                        <Badge variant="outline" className="text-[10px]">
                          Ages {popupEvent.age_min}–{popupEvent.age_max}
                        </Badge>
                      )}
                    </div>
                    <Button asChild size="sm" className="w-full h-7 text-xs mt-1">
                      <Link to={`/events/${popupEvent.id}`}>View Details</Link>
                    </Button>
                  </div>
                </Popup>
              )}
            </MapGL>
          </div>
        )}
      </FadeSwap>
    </div>
  )
}
