import { useEffect, useRef, useState } from 'react'
import { mountLeafletHtmlMarker } from '../../lib/leafletHtmlMarker'
import {
  fetchOsmDrivingRouteVia,
  loadLeaflet,
  OSM_ATTRIBUTION,
  OSM_TILE_URL,
} from '../../lib/osmMaps'
import { haversineM, snapToRoute } from './routeGeometry'

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

function routeKey(points, routeStart, routeEnd) {
  const stops = asLatLngs(points)
    .map((point) => `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`)
    .join('|')
  const start = routeStart ? `${routeStart.lat},${routeStart.lng}` : ''
  const end = routeEnd ? `${routeEnd.lat},${routeEnd.lng}` : ''
  return `${stops}::${start}::${end}`
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2
}

const MOVE_MS = 900

/**
 * Map plot (reference):
 * 1. first stop (min stop_sequence) highlighted
 * 2. intermediate stops as regular dots
 * 3. OSRM driving path through stops in sequence order
 * 4. last stop (max stop_sequence) highlighted
 * 5. bus at last is_crossed stop (animated on poll)
 */
export function RouteLineMap({ points = [], stops = [], routeStart, routeEnd, bus, busLabel }) {
  const hostRef = useRef(null)
  const mapRef = useRef(null)
  const leafletRef = useRef(null)
  const pathRef = useRef([])
  const lineLayerRef = useRef(null)
  const staticMarkersRef = useRef([])
  const circleLayersRef = useRef([])
  const busMarkerRef = useRef(null)
  const busPosRef = useRef(null)
  const animRef = useRef(0)
  const fittedRef = useRef(false)
  const builtKeyRef = useRef('')
  const [ready, setReady] = useState(false)

  function cancelAnim() {
    if (animRef.current) window.cancelAnimationFrame(animRef.current)
    animRef.current = 0
  }

  function animateBus(handle, from, to, heading, label) {
    cancelAnim()
    handle.update(<BusTag label={label} heading={heading} />)
    const dist = haversineM(from, to)
    if (dist < 1) {
      handle.setPosition(to)
      busPosRef.current = to
      return
    }
    const started = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - started) / MOVE_MS)
      const k = easeInOut(t)
      const next = {
        lat: from.lat + (to.lat - from.lat) * k,
        lng: from.lng + (to.lng - from.lng) * k,
      }
      handle.setPosition(next)
      if (t < 1) {
        animRef.current = window.requestAnimationFrame(tick)
      } else {
        animRef.current = 0
        busPosRef.current = to
      }
    }
    animRef.current = window.requestAnimationFrame(tick)
  }

  // Build / rebuild map only when the stop geometry changes (not on every bus poll).
  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined

    let cancelled = false
    const key = routeKey(points, routeStart, routeEnd)

    async function build() {
      const L = await loadLeaflet()
      if (cancelled || !hostRef.current) return

      if (!mapRef.current) {
        const waypoints = asLatLngs(points)
        const start = waypoints[0] || routeStart || routeEnd || { lat: 17.4, lng: 78.48 }
        leafletRef.current = L
        mapRef.current = L.map(hostRef.current, {
          center: [start.lat, start.lng],
          zoom: 12,
          zoomControl: false,
          attributionControl: true,
        })
        L.tileLayer(OSM_TILE_URL, { attribution: OSM_ATTRIBUTION, maxZoom: 19 }).addTo(mapRef.current)
      }

      if (builtKeyRef.current === key && pathRef.current.length) {
        setReady(true)
        return
      }

      const map = mapRef.current
      cancelAnim()
      busMarkerRef.current?.clear()
      busMarkerRef.current = null
      busPosRef.current = null
      staticMarkersRef.current.forEach((marker) => marker.clear())
      staticMarkersRef.current = []
      circleLayersRef.current.forEach((layer) => {
        try {
          map.removeLayer(layer)
        } catch {
          /* gone */
        }
      })
      circleLayersRef.current = []
      if (lineLayerRef.current) {
        try {
          map.removeLayer(lineLayerRef.current)
        } catch {
          /* gone */
        }
        lineLayerRef.current = null
      }

      const waypoints = asLatLngs(points)
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
      if (cancelled || !mapRef.current) return

      pathRef.current = pathPoints
      const line = pathPoints.map((point) => [point.lat, point.lng])
      lineLayerRef.current =
        line.length > 1
          ? L.polyline(line, { color: '#2f6bff', weight: 5, smoothFactor: 0 }).addTo(map)
          : null

      const startId = routeStart?.id
      const endId = routeEnd?.id
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
          circleLayersRef.current.push(circle)
        })

      if (routeStart && Number.isFinite(Number(routeStart.lat)) && Number.isFinite(Number(routeStart.lng))) {
        staticMarkersRef.current.push(
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
        staticMarkersRef.current.push(
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

      builtKeyRef.current = key
      fittedRef.current = false
      setReady(true)

      const fitPads = { paddingTopLeft: [28, 64], paddingBottomRight: [28, 36] }
      const fitMap = () => {
        if (!mapRef.current) return
        if (lineLayerRef.current) {
          mapRef.current.fitBounds(lineLayerRef.current.getBounds(), fitPads)
        }
      }
      fitMap()
      requestAnimationFrame(() => {
        if (cancelled || !mapRef.current) return
        mapRef.current.invalidateSize()
        fitMap()
        fittedRef.current = true
      })
    }

    build().catch(() => {})

    return () => {
      cancelled = true
    }
  }, [points, stops, routeStart, routeEnd])

  // Animate bus marker on poll updates without remounting the route.
  useEffect(() => {
    const map = mapRef.current
    const L = leafletRef.current
    if (!ready || !map || !L) return undefined

    if (!bus || !Number.isFinite(Number(bus.lat)) || !Number.isFinite(Number(bus.lng))) {
      cancelAnim()
      busMarkerRef.current?.clear()
      busMarkerRef.current = null
      busPosRef.current = null
      return undefined
    }

    const snapped = snapToRoute(bus, pathRef.current)
    // Live GPS (recent_positions): keep true spot; face next stop via bus.heading.
    // Estimate: sit on the OSRM line and use path heading when available.
    const live = bus.source === 'live'
    const busPos = live
      ? { lat: Number(bus.lat), lng: Number(bus.lng) }
      : snapped?.point || { lat: Number(bus.lat), lng: Number(bus.lng) }
    const heading = live
      ? Number(bus.heading) || 0
      : Number.isFinite(Number(snapped?.heading))
        ? Number(snapped.heading)
        : Number(bus.heading) || 0

    if (!busMarkerRef.current) {
      busMarkerRef.current = mountLeafletHtmlMarker({
        L,
        map,
        position: busPos,
        zIndex: 3,
        className: 'rd-pin-host',
        node: <BusTag label={busLabel} heading={heading} />,
      })
      busPosRef.current = busPos
      return undefined
    }

    animateBus(busMarkerRef.current, busPosRef.current || busPos, busPos, heading, busLabel)
    return undefined
  }, [ready, bus, busLabel])

  useEffect(() => {
    return () => {
      cancelAnim()
      busMarkerRef.current?.clear()
      busMarkerRef.current = null
      staticMarkersRef.current.forEach((marker) => marker.clear())
      staticMarkersRef.current = []
      circleLayersRef.current.forEach((layer) => {
        try {
          mapRef.current?.removeLayer(layer)
        } catch {
          /* gone */
        }
      })
      circleLayersRef.current = []
      if (lineLayerRef.current) {
        try {
          mapRef.current?.removeLayer(lineLayerRef.current)
        } catch {
          /* gone */
        }
      }
      mapRef.current?.remove()
      mapRef.current = null
      leafletRef.current = null
      pathRef.current = []
      builtKeyRef.current = ''
    }
  }, [])

  return <div ref={hostRef} className="rd-map" />
}
