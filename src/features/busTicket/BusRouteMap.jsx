import { useEffect, useRef } from 'react'
import { loadLeaflet, OSM_ATTRIBUTION, OSM_TILE_URL } from '../../lib/osmMaps'

const WALK_ROUTER_BASE = (
  String(import.meta.env.VITE_OSM_ROUTER_URL || '').trim() || 'https://router.project-osrm.org'
).replace(/\/$/, '')

/** Street walking route used only by the onboard bus ticket map. */
async function fetchBusWalkRoute({ fromLat, fromLng, toLat, toLng }) {
  const coords = `${Number(fromLng)},${Number(fromLat)};${Number(toLng)},${Number(toLat)}`
  const response = await fetch(
    `${WALK_ROUTER_BASE}/route/v1/foot/${coords}?overview=full&geometries=geojson`,
  )
  if (!response.ok) throw new Error(`Walk route failed (${response.status})`)
  const data = await response.json()
  const geometry = data?.routes?.[0]?.geometry?.coordinates
  if (data?.code !== 'Ok' || !geometry?.length) {
    throw new Error(`Walk route failed (${data?.code || 'empty'})`)
  }
  return {
    path: geometry.map(([lng, lat]) => ({ lat: Number(lat), lng: Number(lng) })),
    durationSec: Number(data.routes[0].duration) || 0,
  }
}

function coord(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * Walking path only: the rider's coordinates to the selected boarding stop.
 * OpenStreetMap tiles, street route from the walking router.
 */
export function BusRouteMap({ fromLat, fromLng, toLat, toLng }) {
  const hostRef = useRef(null)
  const originLat = coord(fromLat)
  const originLng = coord(fromLng)
  const boardLat = coord(toLat)
  const boardLng = coord(toLng)

  useEffect(() => {
    const host = hostRef.current
    if (!host || originLat == null || originLng == null || boardLat == null || boardLng == null) {
      return undefined
    }
    let cancelled = false
    let map

    loadLeaflet()
      .then(async (L) => {
        if (cancelled || !hostRef.current) return
        map = L.map(hostRef.current, {
          center: [originLat, originLng],
          zoom: 16,
          zoomControl: false,
          attributionControl: true,
        })
        L.tileLayer(OSM_TILE_URL, {
          attribution: OSM_ATTRIBUTION,
          maxZoom: 19,
        }).addTo(map)

        const route = await fetchBusWalkRoute({
          fromLat: originLat,
          fromLng: originLng,
          toLat: boardLat,
          toLng: boardLng,
        })
        if (cancelled) return

        const latLngs = route.path.map((point) => [point.lat, point.lng])
        const line = L.polyline(latLngs, {
          color: '#222222',
          weight: 5,
          opacity: 1,
        }).addTo(map)
        L.circleMarker([originLat, originLng], {
          radius: 7,
          color: '#ffffff',
          weight: 2,
          fillColor: '#ff5f1f',
          fillOpacity: 1,
        }).addTo(map)
        L.circleMarker([boardLat, boardLng], {
          radius: 7,
          color: '#ffffff',
          weight: 2,
          fillColor: '#2eae4f',
          fillOpacity: 1,
        }).addTo(map)
        if (route.durationSec > 0) {
          const mid = route.path[Math.floor(route.path.length / 2)]
          const minutes = Math.max(1, Math.round(route.durationSec / 60))
          L.marker([mid.lat, mid.lng], {
            interactive: false,
            icon: L.divIcon({
              className: 'bt-map-time',
              html: `<span>${minutes} min</span>`,
              iconSize: [52, 22],
              iconAnchor: [26, 28],
            }),
          }).addTo(map)
        }
        map.fitBounds(line.getBounds(), { padding: [36, 36] })
        requestAnimationFrame(() => map.invalidateSize())
      })
      .catch(() => {})

    return () => {
      cancelled = true
      if (map) map.remove()
    }
  }, [boardLat, boardLng, originLat, originLng])

  return (
    <div className="bt-map">
      <div ref={hostRef} className="bt-map__canvas" />
    </div>
  )
}
