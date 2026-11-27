import { useEffect, useMemo, useRef, useState } from 'react'
import { mountLeafletHtmlMarker } from '../../lib/leafletHtmlMarker'
import { loadLeaflet, OSM_ATTRIBUTION, OSM_TILE_URL } from '../../lib/osmMaps'

function BusPin({ code, color = '#2563eb', heading = null, showDirection = false }) {
  const face = showDirection && Number.isFinite(Number(heading))
  const rotation = face ? Number(heading) : 0
  return (
    <div className="br-bus" role="button" aria-label={`Bus ${code}`}>
      <span className="br-bus__tag">
        <svg className="br-bus__tag-icon" viewBox="0 0 16 16" aria-hidden="true">
          <rect x="1.5" y="4" width="10" height="7" rx="1.4" fill="#2f6bff" />
          <rect x="3" y="5.4" width="2.4" height="2.2" rx="0.3" fill="#fff" />
          <rect x="6.2" y="5.4" width="2.4" height="2.2" rx="0.3" fill="#fff" />
          <circle cx="4.2" cy="11.6" r="1" fill="#1c1c1c" />
          <circle cx="8.6" cy="11.6" r="1" fill="#1c1c1c" />
          <path d="M11.4 6.2h2.4l1.4 1.8v2.2h-3.8V6.2Z" fill="#2f6bff" />
        </svg>
        {code}
      </span>
      {/* Same bus-shape pin as before; rotate only when recent_positions gives a bearing. */}
      <span
        className="br-bus__rig"
        style={{ transform: `translate(-50%, -50%) rotate(${rotation}deg)` }}
      >
        {face ? <span className="br-bus__arrow" style={{ borderBottomColor: color }} /> : null}
        <span className="br-bus__body" style={{ background: color }} />
      </span>
    </div>
  )
}

function MapControls({ onZoomIn, onZoomOut, onLocate }) {
  return (
    <>
      <button type="button" className="br-locate" onClick={onLocate} aria-label="My location">
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M10 2.5v2.2M10 15.3v2.2M2.5 10h2.2M15.3 10h2.2"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <div className="br-zoom">
        <button type="button" onClick={onZoomIn} aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={onZoomOut} aria-label="Zoom out">
          −
        </button>
      </div>
    </>
  )
}

function point(value) {
  if (!value || !Number.isFinite(Number(value.lat)) || !Number.isFinite(Number(value.lng))) return null
  return { lat: Number(value.lat), lng: Number(value.lng) }
}

function sameStop(a, b) {
  return Math.abs(Number(a.lat) - Number(b.lat)) < 1e-5 && Math.abs(Number(a.lng) - Number(b.lng)) < 1e-5
}

function metersBetween(a, b) {
  const dLat = (Number(a.lat) - Number(b.lat)) * 111320
  const dLng =
    (Number(a.lng) - Number(b.lng)) *
    111320 *
    Math.max(Math.cos((Number(a.lat) * Math.PI) / 180), 0.2)
  return Math.hypot(dLat, dLng)
}

/** Stable hash → [0,1) so overlapping boarding pins keep a fixed micro-offset. */
function unitHash(value) {
  const raw = String(value || '')
  let hash = 2166136261
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967296
}

/**
 * Plot true coords when we have vehicle GPS.
 * nearby-buses often only has boarding_stop — then many buses share one lat/lng.
 * Use a tiny, id-stable nudge (not a 120 m hex ring) so stacks stay readable
 * without looking randomly planted off-road.
 */
function pinPosition(bus, index, buses) {
  const base = { lat: Number(bus.lat), lng: Number(bus.lng) }
  if (bus.positionSource === 'vehicle') return base
  const stacked = buses.filter((other) => sameStop(other, bus)).length
  if (stacked <= 1) return base
  const angle = unitHash(bus.id || bus.vehicleId || index) * Math.PI * 2
  const meters = 10 + unitHash(`${bus.id}:r`) * 14
  return {
    lat: base.lat + (meters / 111320) * Math.cos(angle),
    lng:
      base.lng +
      (meters / (111320 * Math.max(Math.cos((base.lat * Math.PI) / 180), 0.2))) * Math.sin(angle),
  }
}

/** Prefer the tightest group of nearby boarding points (default zoom target). */
function focusBuses(buses, center) {
  const usable = buses.filter((bus) => Number.isFinite(bus.lat) && Number.isFinite(bus.lng))
  if (usable.length <= 1) return usable

  const origin = center || usable[0]
  const nearby = usable
    .map((bus) => ({ bus, d: metersBetween(bus, origin) }))
    .sort((a, b) => a.d - b.d)

  // Take buses within 350 m of the rider (or of the nearest bus).
  const close = nearby.filter((row) => row.d <= 350).map((row) => row.bus)
  if (close.length >= 2) return close

  // Fallback: nearest half of the fleet so outliers do not pull the camera out.
  const take = Math.max(3, Math.ceil(usable.length / 2))
  return nearby.slice(0, take).map((row) => row.bus)
}

/**
 * Default map view: street-level on nearby buses (with fan-out), not the full corridor.
 * Uses setView (not fitBounds) so a late invalidateSize cannot leave pins off-screen.
 */
function fitLiveBusView(map, L, buses, center, destination) {
  if (!map || !L) return
  const usable = buses.filter((bus) => Number.isFinite(bus.lat) && Number.isFinite(bus.lng))
  if (!usable.length) {
    if (center) map.setView([center.lat, center.lng], 17, { animate: false })
    else if (destination) map.setView([destination.lat, destination.lng], 16, { animate: false })
    return
  }

  const focus = focusBuses(usable, center)
  const spots = focus.map((bus) => {
    const index = usable.indexOf(bus)
    const pin = pinPosition(bus, index, usable)
    return L.latLng(pin.lat, pin.lng)
  })
  if (center) {
    const mid = L.latLngBounds(spots).getCenter()
    if (metersBetween(center, mid) < 400) spots.push(L.latLng(center.lat, center.lng))
  }

  const mid = L.latLngBounds(spots).getCenter()
  map.setView(mid, 18, { animate: false })
}

const MOVE_MS = 1200

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2
}

function OsmLiveBusMap({ center, destination, buses, onSelect }) {
  const hostRef = useRef(null)
  const mapRef = useRef(null)
  const leafletRef = useRef(null)
  const markersByIdRef = useRef(new Map())
  const animByIdRef = useRef(new Map())
  const busesByIdRef = useRef(new Map())
  const placesRef = useRef([])
  const fittedRef = useRef(false)
  const placesKeyRef = useRef('')
  const centerRef = useRef(center)
  const onSelectRef = useRef(onSelect)
  const [ready, setReady] = useState(false)
  centerRef.current = center
  onSelectRef.current = onSelect

  function cancelAnim(id) {
    const frame = animByIdRef.current.get(id)
    if (frame) window.cancelAnimationFrame(frame)
    animByIdRef.current.delete(id)
  }

  function animateMarker(id, handle, from, to) {
    cancelAnim(id)
    const dist = metersBetween(from, to)
    if (dist < 1) {
      handle.setPosition(to)
      handle.lastPos = to
      return
    }
    // Large jumps are boarding↔live GPS swaps or stop reassignment — snap, don't teleport-glide.
    if (dist > 450) {
      handle.setPosition(to)
      handle.lastPos = to
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
        animByIdRef.current.set(id, window.requestAnimationFrame(tick))
      } else {
        animByIdRef.current.delete(id)
        handle.lastPos = to
      }
    }
    animByIdRef.current.set(id, window.requestAnimationFrame(tick))
  }

  useEffect(() => {
    let cancelled = false
    loadLeaflet().then((L) => {
      if (cancelled || !hostRef.current || mapRef.current) return
      leafletRef.current = L
      const start = centerRef.current || { lat: 17.44, lng: 78.48 }
      const map = L.map(hostRef.current, {
        center: [start.lat, start.lng],
        zoom: 18,
        zoomControl: false,
        attributionControl: true,
      })
      L.tileLayer(OSM_TILE_URL, { attribution: OSM_ATTRIBUTION, maxZoom: 19 }).addTo(map)
      mapRef.current = map
      requestAnimationFrame(() => {
        map.invalidateSize()
        setReady(true)
      })
    })
    return () => {
      cancelled = true
      animByIdRef.current.forEach((frame) => window.cancelAnimationFrame(frame))
      animByIdRef.current.clear()
      markersByIdRef.current.forEach((marker) => marker.clear())
      markersByIdRef.current.clear()
      placesRef.current.forEach((layer) => mapRef.current?.removeLayer(layer))
      placesRef.current = []
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const L = leafletRef.current
    if (!ready || !map || !L) return

    const placesKey = [
      center ? `${center.lat},${center.lng}` : '',
      destination ? `${destination.lat},${destination.lng},${destination.name || ''}` : '',
    ].join('|')
    if (placesKey !== placesKeyRef.current) {
      placesRef.current.forEach((layer) => map.removeLayer(layer))
      const places = []
      if (center) {
        places.push(
          L.circleMarker([center.lat, center.lng], {
            radius: 8,
            color: '#fff',
            weight: 3,
            fillColor: '#ff5a1f',
            fillOpacity: 1,
          })
            .bindTooltip('You', { direction: 'top' })
            .addTo(map),
        )
      }
      if (destination) {
        places.push(
          L.circleMarker([destination.lat, destination.lng], {
            radius: 8,
            color: '#fff',
            weight: 3,
            fillColor: '#e11d2e',
            fillOpacity: 1,
          })
            .bindTooltip(destination.name || 'Alight', { direction: 'top' })
            .addTo(map),
        )
      }
      placesRef.current = places
      placesKeyRef.current = placesKey
    }

    busesByIdRef.current = new Map(buses.map((bus) => [bus.id, bus]))
    const nextIds = new Set(buses.map((bus) => bus.id))
    markersByIdRef.current.forEach((handle, id) => {
      if (nextIds.has(id)) return
      cancelAnim(id)
      handle.clear()
      markersByIdRef.current.delete(id)
    })

    buses.forEach((bus, index) => {
      const pos = pinPosition(bus, index, buses)
      const existing = markersByIdRef.current.get(bus.id)
      const canOpen = Boolean(bus.routeId || bus.vehicleId)
      const node = (
        <BusPin
          code={bus.code}
          color={bus.color}
          heading={bus.heading}
          showDirection={bus.showDirection}
        />
      )
      if (existing) {
        existing.update(node)
        animateMarker(bus.id, existing, existing.lastPos || pos, pos)
        return
      }
      const busId = bus.id
      const handle = mountLeafletHtmlMarker({
        L,
        map,
        position: pos,
        className: 'br-bus-host',
        interactive: canOpen,
        onClick: canOpen
          ? () => {
              const latest = busesByIdRef.current.get(busId)
              if (latest) onSelectRef.current?.(latest)
            }
          : undefined,
        node,
      })
      handle.lastPos = pos
      markersByIdRef.current.set(bus.id, handle)
    })

    const shouldFit = !fittedRef.current && (buses.length || center || destination)
    map.invalidateSize()
    if (!shouldFit) return undefined

    const runFit = () => {
      map.invalidateSize()
      fitLiveBusView(map, L, buses, center, destination)
    }
    runFit()
    const t1 = window.setTimeout(runFit, 50)
    const t2 = window.setTimeout(() => {
      runFit()
      fittedRef.current = true
    }, 200)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [ready, buses, center, destination])

  function zoomBy(delta) {
    const map = mapRef.current
    if (!map) return
    map.setZoom(map.getZoom() + delta)
  }

  function locate() {
    const map = mapRef.current
    if (!map || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition((position) => {
      map.setView([position.coords.latitude, position.coords.longitude], 16)
    })
  }

  return (
    <div className="br-map">
      <div ref={hostRef} className="br-map__canvas" />
      <MapControls onZoomIn={() => zoomBy(1)} onZoomOut={() => zoomBy(-1)} onLocate={locate} />
    </div>
  )
}

export function LiveBusMap({ center, destination, buses = [], onSelect }) {
  const focus = useMemo(() => point(center), [center?.lat, center?.lng])
  const destName = destination?.name || ''
  const dropoff = useMemo(() => {
    const alight = point(destination)
    return alight ? { ...alight, name: destName } : null
  }, [destination?.lat, destination?.lng, destName])
  return <OsmLiveBusMap center={focus} destination={dropoff} buses={buses} onSelect={onSelect} />
}
