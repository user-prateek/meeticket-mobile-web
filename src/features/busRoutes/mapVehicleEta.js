import { routeCode, routeCorridor, routeHeading, titleLabel } from './mapBusRoutes'

function coord(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** "18:04:58" → "6:04 PM" */
export function formatClock(value) {
  const raw = String(value || '').trim()
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!match) return raw
  let hour = Number(match[1])
  const minute = match[2]
  if (!Number.isFinite(hour)) return raw
  const period = hour >= 12 ? 'PM' : 'AM'
  hour = hour % 12 || 12
  return `${hour}:${minute} ${period}`
}

/** Parse "HH:MM:SS" onto today's calendar day (ms since epoch). */
export function parseClockToMs(value, now = Date.now()) {
  const match = String(value || '')
    .trim()
    .match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) return null
  const base = new Date(now)
  base.setHours(Number(match[1]), Number(match[2]), Number(match[3] || 0), 0)
  return base.getTime()
}

const DEFAULT_LEG_MS = 3 * 60 * 1000

/**
 * Estimate bus between last crossed stop and the next using stop clocks.
 * progress ≈ (now − left_stop_time) / (next_stop_time − left_stop_time).
 * Prefer `at` (live/predicted), fall back to `st` (scheduled). Caps below 1 so
 * the marker approaches the next stop until `is_crossed` flips.
 */
export function estimateBusAlongStops(stops, now = Date.now()) {
  const list = Array.isArray(stops) ? stops : []
  if (!list.length) return null

  let lastIdx = -1
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i].crossed) {
      lastIdx = i
      break
    }
  }

  // No stop crossed yet → bus is still at the first stop.
  if (lastIdx < 0) {
    const first = list[0]
    const next = list[1]
    return {
      lat: first.lat,
      lng: first.lng,
      heading: routeHeading(first.lat, first.lng, next?.lat, next?.lng),
      progress: 0,
    }
  }

  const from = list[lastIdx]
  const to = list[lastIdx + 1]
  if (!to) {
    return { lat: from.lat, lng: from.lng, heading: 0, progress: 1 }
  }

  const fromAt = from.atMs ?? null
  const toAt = to.atMs ?? null
  const fromSt = from.stMs ?? null
  const toSt = to.stMs ?? null

  let startMs = fromAt ?? fromSt
  let endMs = toAt ?? toSt

  // If live clocks are missing/inverted, keep departure and use scheduled leg length.
  if (startMs == null || endMs == null || endMs <= startMs) {
    const scheduled =
      fromSt != null && toSt != null && toSt > fromSt ? toSt - fromSt : DEFAULT_LEG_MS
    startMs = fromAt ?? fromSt ?? now
    endMs = startMs + Math.max(scheduled, 30_000)
  }

  const duration = Math.max(endMs - startMs, 1)
  const elapsed = now - startMs
  const t = Math.max(0, Math.min(0.95, elapsed / duration))
  const lat = from.lat + (to.lat - from.lat) * t
  const lng = from.lng + (to.lng - from.lng) * t
  return {
    lat,
    lng,
    heading: routeHeading(from.lat, from.lng, to.lat, to.lng),
    progress: t,
  }
}

function placeFromRoute(routeName, fallback) {
  const corridor = routeCorridor(routeName)
  if (corridor) {
    const [from, to] = corridor.split('→').map((part) => part.trim())
    return { from: from || fallback.from, to: to || fallback.to }
  }
  return fallback
}

/**
 * TGSRTC `/vehicles/{id}/eta` → route detail view model (map + stops + departures).
 * Stops are always sorted by stop_sequence (low = start, high = end).
 */
export function mapVehicleEta(data) {
  const board = data?.nearest_boarding_stop || {}
  const drop = data?.drop_stop || {}
  const rawStops = Array.isArray(data?.stops) ? data.stops : []
  const boardId = String(board.stop_id || '')
  const dropId = String(drop.stop_id || '')

  const now = Date.now()
  const stops = rawStops
    .map((stop) => {
      const id = String(stop.stop_id || '')
      const lat = coord(stop.stop_lat)
      const lng = coord(stop.stop_lon)
      if (lat == null || lng == null) return null
      const sequence = Number(stop.stop_sequence)
      const clock = stop.at || stop.st || ''
      return {
        id: id || `${lat},${lng}`,
        name: titleLabel(stop.stop_name),
        time: formatClock(clock),
        role: '',
        lat,
        lng,
        crossed: Boolean(stop.is_crossed),
        sequence: Number.isFinite(sequence) ? sequence : 0,
        at: stop.at || '',
        st: stop.st || '',
        atMs: parseClockToMs(stop.at, now),
        stMs: parseClockToMs(stop.st, now),
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.sequence - b.sequence)

  // Timeline roles: nearest board / chosen drop (sheet). Map uses first/last by sequence.
  for (const stop of stops) {
    if (stop.id && stop.id === boardId) stop.role = 'pickup'
    else if (stop.id && stop.id === dropId) stop.role = 'drop'
    else if (stop.crossed) stop.role = 'passed'
  }

  const routeStart = stops[0] || null
  const routeEnd = stops.length ? stops[stops.length - 1] : null
  const boarding = stops.find((stop) => stop.role === 'pickup') || routeStart

  // Live GPS when API sends it; else time-based estimate between crossed stops.
  const liveLat =
    coord(data?.lat) ??
    coord(data?.vehicle_lat) ??
    coord(data?.current_lat) ??
    coord(data?.vehicle_latitude)
  const liveLng =
    coord(data?.lon) ??
    coord(data?.lng) ??
    coord(data?.vehicle_lon) ??
    coord(data?.current_lon) ??
    coord(data?.vehicle_longitude)
  const liveHeading = coord(data?.heading) ?? coord(data?.bearing)
  const estimated = estimateBusAlongStops(stops, now)
  const busLat = liveLat ?? estimated?.lat ?? null
  const busLng = liveLng ?? estimated?.lng ?? null
  const busHeading = liveHeading ?? estimated?.heading ?? 0
  const busSource = liveLat != null && liveLng != null ? 'live' : 'estimate'

  const eta = Number(board.eta_minutes)
  const etaMinutes = Number.isFinite(eta) && eta >= 0 ? Math.round(eta) : null
  const fare = Number(data?.fare)
  const fareInr = Number.isFinite(fare) && fare > 0 ? Math.round(fare) : null
  const category = titleLabel(data?.service_category)
  const routeName = String(data?.route_name || '')
  const places = placeFromRoute(routeName, {
    from: titleLabel(routeStart?.name || board.stop_name),
    to: titleLabel(routeEnd?.name || drop.stop_name),
  })

  const departures = (Array.isArray(data?.next_departures) ? data.next_departures : [])
    .map((stamp, index) => {
      const time = formatClock(stamp)
      if (!time) return null
      return { id: `${stamp}-${index}`, time }
    })
    .filter(Boolean)

  return {
    routeId: String(data?.chalo_route_id || ''),
    tripId: String(data?.trip_id || ''),
    code: routeCode(routeName) || 'Bus',
    category,
    fareInr,
    fromPlace: places.from,
    toPlace: places.to,
    vehicleNo: String(data?.vehicle_number || ''),
    busType: category || 'Bus',
    boardingName: titleLabel(board.stop_name || boarding?.name),
    busLabel: etaMinutes != null ? `${etaMinutes} min away` : '',
    bus:
      busLat != null && busLng != null
        ? {
            lat: busLat,
            lng: busLng,
            heading: busHeading,
            source: busSource,
            progress: estimated?.progress ?? null,
          }
        : null,
    /** Full route termini for map (min / max stop_sequence). */
    routeStart,
    routeEnd,
    originPin: routeStart ? { lat: routeStart.lat, lng: routeStart.lng } : null,
    destinationPin: routeEnd ? { lat: routeEnd.lat, lng: routeEnd.lng } : null,
    departures,
    stops,
  }
}
