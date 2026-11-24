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

  // Bus sits at the highest-sequence stop that is already crossed.
  let busAt = null
  for (let i = stops.length - 1; i >= 0; i -= 1) {
    if (stops[i].crossed) {
      busAt = stops[i]
      break
    }
  }
  const nextStop =
    (busAt && stops.find((stop) => stop.sequence > busAt.sequence)) || routeEnd || routeStart
  const busLat = busAt?.lat ?? null
  const busLng = busAt?.lng ?? null

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
            heading: routeHeading(busLat, busLng, nextStop?.lat, nextStop?.lng),
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
