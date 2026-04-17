import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

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

interface EventMapMiniProps {
  latitude: number | null
  longitude: number | null
  venueName?: string | null
  address?: string | null
}

export function EventMapMini({ latitude, longitude, venueName, address }: EventMapMiniProps) {
  if (latitude == null || longitude == null) {
    return (
      <div className="rounded-xl bg-muted/50 border border-border/60 h-36 flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Location not mapped</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl overflow-hidden border border-border/60 h-48">
      <MapContainer
        center={[latitude, longitude]}
        zoom={14}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[latitude, longitude]}>
          {(venueName || address) && (
            <Popup>
              {venueName && <p className="font-semibold text-sm">{venueName}</p>}
              {address && <p className="text-xs text-muted-foreground">{address}</p>}
            </Popup>
          )}
        </Marker>
      </MapContainer>
    </div>
  )
}
