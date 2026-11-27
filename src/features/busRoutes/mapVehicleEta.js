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

/** HH:MM key so "13:40:35" and "13:40:00" compare as the same chip. */
function clockKey(value) {
  const match = String(value || '')
    .trim()
    .match(/^(\d{1,2}):(\d{2})/)
  if (!match) return ''
  return `${Number(match[1])}:${match[2]}`
}

/** next_departures entry: `"16:08:13"` or `{ departure_time, vehicle_number }`. */
function departureStamp(entry) {
  if (entry == null) return { stamp: '', vehicleNumber: '' }
  if (typeof entry === 'string' || typeof entry === 'number') {
    return { stamp: String(entry).trim(), vehicleNumber: '' }
  }
  if (typeof entry === 'object') {
    const stamp = String(
      entry.departure_time || entry.departureTime || entry.time || entry.st || '',
    ).trim()
    const vehicleNumber = String(entry.vehicle_number || entry.vehicleNumber || '').trim()
    return { stamp, vehicleNumber }
  }
  return { stamp: '', vehicleNumber: '' }
}

/**
 * Departure chips:
 * 1) nearest_boarding_stop `at` (actual) else `st` (scheduled) → first chip (this vehicle)
 * 2) remaining from `next_departures` (`{ departure_time, vehicle_number }` opens that bus)
 */
export function buildDepartures(board, nextDepartures, { currentVehicleNumber = '' } = {}) {
  const firstStamp = board?.at || board?.st || null
  const firstKey = clockKey(firstStamp)
  const scheduledKey = clockKey(board?.st)
  const currentVehicle = String(currentVehicleNumber || '').trim()
  const seen = new Set()
  const out = []

  function push(stamp, source, vehicleNumber = '') {
    const raw = String(stamp || '').trim()
    const time = formatClock(raw)
    if (!time) return
    const key = clockKey(raw) || time
    if (seen.has(key)) return
    seen.add(key)
    out.push({
      id: `${source}-${vehicleNumber || 'bus'}-${raw}`,
      time,
      stamp: raw,
      source,
      vehicleNumber: vehicleNumber || '',
    })
  }

  if (firstStamp) push(firstStamp, board?.at ? 'at' : 'st', currentVehicle)

  for (const entry of Array.isArray(nextDepartures) ? nextDepartures : []) {
    const { stamp, vehicleNumber } = departureStamp(entry)
    const key = clockKey(stamp)
    if (!key) continue
    if (firstKey && key === firstKey) continue
    // When first chip used live `at`, drop the scheduled twin so both don't show.
    if (board?.at && scheduledKey && key === scheduledKey) continue
    push(stamp, 'next', vehicleNumber)
  }

  return out
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
 * Latest crumb from `recent_positions` (`{ lat, lon, time }`).
 * Contract: last array index is current; fall back to max `time` if needed.
 */
export function latestRecentPosition(positions) {
  const list = Array.isArray(positions) ? positions : []
  if (!list.length) return null

  const last = list[list.length - 1]
  const lastLat = coord(last?.lat)
  const lastLng = coord(last?.lon ?? last?.lng)
  if (lastLat != null && lastLng != null) {
    return { lat: lastLat, lng: lastLng, time: last?.time || '' }
  }

  let best = null
  let bestMs = -1
  for (const row of list) {
    const lat = coord(row?.lat)
    const lng = coord(row?.lon ?? row?.lng)
    if (lat == null || lng == null) continue
    const ms = parseClockToMs(row?.time) ?? 0
    if (!best || ms >= bestMs) {
      best = { lat, lng, time: row?.time || '' }
      bestMs = ms
    }
  }
  return best
}

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
 *
 * `resolveDropToRouteEnd`: when list opened without a destination stop (show_all /
 * filter_by_destination=false), ETA was seeded with boarding as drop — expand
 * alighting to the last stop so the full route is viewable.
 */
export function mapVehicleEta(data, { resolveDropToRouteEnd = false } = {}) {
  const board = data?.nearest_boarding_stop || {}
  const drop = data?.drop_stop || {}
  const rawStops = Array.isArray(data?.stops) ? data.stops : []
  const boardId = String(board.stop_id || '')
  let dropId = String(drop.stop_id || '')

  const now = Date.now()
  const stops = rawStops
    .map((stop) => {
      const id = String(stop.stop_id || '')
      const lat = coord(stop.stop_lat)
      const lng = coord(stop.stop_lon)
      if (lat == null || lng == null) return null
      const sequence = Number(stop.stop_sequence)
      const isBoard = boardId && id === boardId
      // Boarding row prefers nearest_boarding_stop at/st when present.
      const at = (isBoard && board.at) || stop.at || ''
      const st = (isBoard && board.st) || stop.st || ''
      const clock = at || st || ''
      return {
        id: id || `${lat},${lng}`,
        name: titleLabel(stop.stop_name),
        time: formatClock(clock),
        role: '',
        lat,
        lng,
        crossed: Boolean(stop.is_crossed),
        sequence: Number.isFinite(sequence) ? sequence : 0,
        at,
        st,
        atMs: parseClockToMs(at, now),
        stMs: parseClockToMs(st, now),
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.sequence - b.sequence)

  const routeStart = stops[0] || null
  const routeEnd = stops.length ? stops[stops.length - 1] : null

  if (resolveDropToRouteEnd && routeEnd?.id) {
    const boardIdx = boardId ? stops.findIndex((stop) => stop.id === boardId) : -1
    const seedIdx = dropId ? stops.findIndex((stop) => stop.id === dropId) : -1
    // Only expand when seed drop is missing, same as board, or at/before board.
    if (!dropId || dropId === boardId || (boardIdx >= 0 && seedIdx >= 0 && seedIdx <= boardIdx)) {
      dropId = routeEnd.id
    }
  }

  // Timeline roles: nearest board / chosen drop (sheet). Map uses first/last by sequence.
  for (const stop of stops) {
    if (stop.id && stop.id === boardId) stop.role = 'pickup'
    else if (stop.id && stop.id === dropId) stop.role = 'drop'
    else if (stop.crossed) stop.role = 'passed'
  }

  const boarding = stops.find((stop) => stop.role === 'pickup') || routeStart

  // Next stop the bus is heading toward (first not yet crossed).
  let lastCrossedIdx = -1
  for (let i = stops.length - 1; i >= 0; i -= 1) {
    if (stops[i].crossed) {
      lastCrossedIdx = i
      break
    }
  }
  const nextStop = stops[lastCrossedIdx + 1] || (lastCrossedIdx < 0 ? stops[0] : null) || routeEnd

  // recent_positions → live bus spot; heading faces the next stop.
  const recent = latestRecentPosition(data?.recent_positions)
  const estimated = estimateBusAlongStops(stops, now)
  const busLat = recent?.lat ?? estimated?.lat ?? null
  const busLng = recent?.lng ?? estimated?.lng ?? null
  const busHeading =
    recent && nextStop
      ? routeHeading(recent.lat, recent.lng, nextStop.lat, nextStop.lng)
      : estimated?.heading ?? 0
  const busSource = recent ? 'live' : 'estimate'

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

  const vehicleNo = String(data?.vehicle_number || '').trim()
  const departures = buildDepartures(board, data?.next_departures, {
    currentVehicleNumber: vehicleNo,
  })

  const boardLat = coord(board.stop_lat) ?? boarding?.lat ?? null
  const boardLng = coord(board.stop_lon) ?? boarding?.lng ?? null
  const dropLat = coord(drop.stop_lat) ?? null
  const dropLng = coord(drop.stop_lon) ?? null
  const boardDistanceM = Number(board.distance_m)
  const dropStop =
    stops.find((stop) => stop.role === 'drop') ||
    (!resolveDropToRouteEnd && dropLat != null && dropLng != null
      ? { id: String(drop.stop_id || ''), name: titleLabel(drop.stop_name), lat: dropLat, lng: dropLng }
      : null) ||
    routeEnd

  return {
    routeId: String(data?.chalo_route_id || ''),
    tripId: String(data?.trip_id || ''),
    code: routeCode(routeName) || 'Bus',
    category,
    fareInr,
    fromPlace: places.from,
    toPlace: places.to,
    vehicleNo,
    busType: category || 'Bus',
    boardingName: titleLabel(board.stop_name || boarding?.name),
    alightingName: titleLabel(dropStop?.name || drop.stop_name),
    boardingDistanceM:
      Number.isFinite(boardDistanceM) && boardDistanceM > 0 ? boardDistanceM : null,
    boardingStop: boarding
      ? {
          id: boarding.id,
          name: titleLabel(board.stop_name || boarding.name),
          lat: boardLat ?? boarding.lat,
          lng: boardLng ?? boarding.lng,
        }
      : null,
    alightingStop: dropStop
      ? {
          id: dropStop.id || String(drop.stop_id || ''),
          name: titleLabel(drop.stop_name || dropStop.name),
          lat: dropStop.lat,
          lng: dropStop.lng,
        }
      : null,
    busLabel: etaMinutes != null ? `${etaMinutes} min away` : '',
    bus:
      busLat != null && busLng != null
        ? {
            lat: busLat,
            lng: busLng,
            heading: busHeading,
            source: busSource,
            progress: estimated?.progress ?? null,
            nextStopId: nextStop?.id || null,
          }
        : null,
    recentPositions: Array.isArray(data?.recent_positions)
      ? data.recent_positions
          .map((row) => {
            const lat = coord(row?.lat)
            const lng = coord(row?.lon ?? row?.lng)
            if (lat == null || lng == null) return null
            return { lat, lng, time: row?.time || '' }
          })
          .filter(Boolean)
      : [],
    /** Full route termini for map (min / max stop_sequence). */
    routeStart,
    routeEnd,
    originPin: routeStart ? { lat: routeStart.lat, lng: routeStart.lng } : null,
    destinationPin: routeEnd ? { lat: routeEnd.lat, lng: routeEnd.lng } : null,
    departures,
    stops,
  }
}
