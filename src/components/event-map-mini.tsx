import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

const PinIcon = L.divIcon({
  className: "",
  iconSize: [28, 36],
  iconAnchor: [14, 36],
  popupAnchor: [0, -38],
  html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 36" width="28" height="36">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 9.94 14 22 14 22S28 23.94 28 14C28 6.27 21.73 0 14 0z" fill="hsl(221,83%,53%)" />
    <circle cx="14" cy="14" r="5.5" fill="white" />
  </svg>`,
})

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
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
        />
        <Marker position={[latitude, longitude]} icon={PinIcon}>
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
