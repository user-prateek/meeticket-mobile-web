import { useEffect, useRef } from 'react'
import { mountLeafletHtmlMarker } from '../../lib/leafletHtmlMarker'
import {
  fetchOsmDrivingRouteVia,
  loadLeaflet,
  OSM_ATTRIBUTION,
  OSM_TILE_URL,
} from '../../lib/osmMaps'
import { snapToRoute } from './routeGeometry'

/** Route start — plain blue circle (no vehicle glyph). */
function StartPin() {
  return <span className="rd-pin rd-pin--start" aria-hidden="true" />
}

/** Route end — red stop marker (reference). */
function EndPin() {
  return (
    <span className="rd-pin rd-pin--end" aria-hidden="true">
      <span className="rd-pin__stop" />
    </span>
  )
}

/** Top-down bus; nose points north (0°) so CSS rotate(heading) faces travel. */
function BusTag({ label, heading = 0 }) {
  return (
    <div className="rd-bus">
      {label ? <span className="rd-bus__label">{label}</span> : null}
      <span
        className="rd-bus__body"
        aria-hidden="true"
        style={{ transform: `translate(-50%, -50%) rotate(${heading}deg)` }}
      >
        <svg width="22" height="36" viewBox="0 0 22 36">
          <rect x="3" y="2" width="16" height="32" rx="5" fill="#e11d2e" stroke="#fff" strokeWidth="1.6" />
          <rect x="5.5" y="5" width="11" height="7" rx="1.4" fill="#93c5fd" />
          <rect x="5.5" y="14" width="11" height="5" rx="1" fill="#fecaca" />
          <rect x="5.5" y="21" width="11" height="5" rx="1" fill="#fecaca" />
          <circle cx="7" cy="30.5" r="1.4" fill="#1f2937" />
          <circle cx="15" cy="30.5" r="1.4" fill="#1f2937" />
          <path d="M7 2.4h8l-1.2 2.2H8.2Z" fill="#fff" opacity="0.9" />
        </svg>
      </span>
    </div>
  )
}

function asLatLngs(points) {
  return (points || [])
    .map((point) => ({ lat: Number(point?.lat), lng: Number(point?.lng) }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
}

/**
 * Map plot (reference):
 * 1. first stop (min stop_sequence) highlighted
 * 2. intermediate stops as regular dots
 * 3. OSRM driving path through stops in sequence order
 * 4. last stop (max stop_sequence) highlighted
 * 5. bus at last is_crossed stop
 */
export function RouteLineMap({ points = [], stops = [], routeStart, routeEnd, bus, busLabel }) {
  const hostRef = useRef(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined

    let cancelled = false
    let map = null
    let lineLayer = null
    const markerHandles = []
    const circleLayers = []
    const waypoints = asLatLngs(points)

    loadLeaflet()
      .then(async (L) => {
        if (cancelled || !hostRef.current) return

        const start = waypoints[0] || routeStart || routeEnd || { lat: 17.4, lng: 78.48 }
        map = L.map(hostRef.current, {
          center: [start.lat, start.lng],
          zoom: 12,
          zoomControl: false,
          attributionControl: true,
        })
        L.tileLayer(OSM_TILE_URL, { attribution: OSM_ATTRIBUTION, maxZoom: 19 }).addTo(map)

        let pathPoints = waypoints
        if (waypoints.length > 1) {
          try {
            const route = await fetchOsmDrivingRouteVia(waypoints)
            if (!cancelled && route?.path?.length) pathPoints = route.path
          } catch (error) {
            if (import.meta.env.DEV) {
              console.warn('[livebus] OSRM road route unavailable', error)
            }
          }
        }
        if (cancelled || !map) return

        const line = pathPoints.map((point) => [point.lat, point.lng])
        lineLayer =
          line.length > 1
            ? L.polyline(line, { color: '#2f6bff', weight: 5, smoothFactor: 0 }).addTo(map)
            : null

        const startId = routeStart?.id
        const endId = routeEnd?.id
        // Intermediate stops only — start/end use dedicated markers.
        asLatLngs(stops)
          .map((stop, index) => ({ ...stop, id: stops[index]?.id, name: stops[index]?.name }))
          .filter((stop) => stop.id !== startId && stop.id !== endId)
          .forEach((stop) => {
            const circle = L.circleMarker([stop.lat, stop.lng], {
              radius: 5,
              color: '#2f6bff',
              weight: 2,
              fillColor: '#ffffff',
              fillOpacity: 1,
            }).addTo(map)
            if (stop.name) circle.bindTooltip(stop.name, { direction: 'top', opacity: 0.95 })
            circleLayers.push(circle)
          })

        if (routeStart && Number.isFinite(Number(routeStart.lat)) && Number.isFinite(Number(routeStart.lng))) {
          markerHandles.push(
            mountLeafletHtmlMarker({
              L,
              map,
              position: routeStart,
              zIndex: 2,
              className: 'rd-pin-host',
              node: <StartPin />,
            }),
          )
        }
        if (routeEnd && Number.isFinite(Number(routeEnd.lat)) && Number.isFinite(Number(routeEnd.lng))) {
          markerHandles.push(
            mountLeafletHtmlMarker({
              L,
              map,
              position: routeEnd,
              zIndex: 2,
              className: 'rd-pin-host',
              node: <EndPin />,
            }),
          )
        }
        if (bus && Number.isFinite(Number(bus.lat)) && Number.isFinite(Number(bus.lng))) {
          // Always sit on the plotted OSRM line and face that segment's travel direction.
          const snapped = snapToRoute(bus, pathPoints)
          const busPos = snapped?.point || bus
          const heading = Number.isFinite(Number(snapped?.heading)) ? Number(snapped.heading) : 0
          markerHandles.push(
            mountLeafletHtmlMarker({
              L,
              map,
              position: busPos,
              zIndex: 3,
              className: 'rd-pin-host',
              node: <BusTag label={busLabel} heading={heading} />,
            }),
          )
        }

        if (lineLayer) {
          map.fitBounds(lineLayer.getBounds(), {
            paddingTopLeft: [28, 64],
            paddingBottomRight: [28, 36],
          })
        }
        requestAnimationFrame(() => {
          if (cancelled || !map) return
          map.invalidateSize()
          if (lineLayer) {
            map.fitBounds(lineLayer.getBounds(), {
              paddingTopLeft: [28, 64],
              paddingBottomRight: [28, 36],
            })
          }
        })
      })
      .catch(() => {})

    return () => {
      cancelled = true
      markerHandles.forEach((marker) => marker.clear())
      circleLayers.forEach((circle) => {
        try {
          map?.removeLayer(circle)
        } catch {
          /* map already gone */
        }
      })
      if (lineLayer) {
        try {
          map?.removeLayer(lineLayer)
        } catch {
          /* map already gone */
        }
      }
      map?.remove()
      map = null
    }
  }, [points, stops, routeStart, routeEnd, bus, busLabel])

  useEffect(() => {
    const host = hostRef.current
    if (!host || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(() => {
      host.dispatchEvent(new Event('rd-map-resize'))
    })
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  return <div ref={hostRef} className="rd-map" />
}
