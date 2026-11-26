const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'ordinary', label: 'Ordinary' },
  { id: 'deluxe', label: 'Deluxe' },
  { id: 'ac', label: 'AC' },
]

export const BUS_ROUTE_FILTERS = FILTERS

function titleWord(word) {
  const raw = String(word || '').trim()
  if (!raw) return ''
  const letters = raw.replace(/[^A-Za-z]/g, '')
  const isUpper = letters && letters === letters.toUpperCase()
  const isLower = letters && letters === letters.toLowerCase()
  if (isUpper && letters.length <= 4) return raw
  if (!isUpper && !isLower) return raw
  const text = raw.toLowerCase()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function titleLabel(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .map(titleWord)
    .join(' ')
}

function routeParts(routeName) {
  return String(routeName || '')
    .split('-')
    .map((part) => part.trim())
    .filter(Boolean)
}

export function routeCode(routeName) {
  return routeParts(routeName)[0] || ''
}

const SERVICE_TOKENS = new Set([
  'SILVER',
  'GOLD',
  'METRO',
  'EXPRESS',
  'ORDINARY',
  'DELUXE',
  'AC',
  'SUPER',
  'LUXURY',
  'GARUDA',
])

function placeName(value) {
  return String(value || '')
    .split(/[\s/]+/)
    .filter((part) => part && !SERVICE_TOKENS.has(part.toUpperCase()))
    .filter((part) => part.length > 3 || !/^[A-Z0-9]+$/.test(part))
    .map(titleWord)
    .join(' ')
}

/** "10K/J-SILVER-JAGATHGIRIGUTTA-TO-SECUNDERABAD" → "Jagathgirigutta → Secunderabad" */
export function routeCorridor(routeName) {
  const parts = routeParts(routeName)
  const toAt = parts.findIndex((part) => part.toUpperCase() === 'TO')
  let from = ''
  let to = ''
  if (toAt > 0 && toAt < parts.length - 1) {
    from = placeName(parts.slice(1, toAt).join(' '))
    to = placeName(parts.slice(toAt + 1).join(' '))
  } else {
    const inline = parts.slice(1).join(' ').match(/^(.*?)\s+TO\s+(.*)$/i)
    if (inline) {
      from = placeName(inline[1])
      to = placeName(inline[2])
    }
  }
  if (!from || !to) return ''
  return `${from} → ${to}`
}

export function formatDistance(meters) {
  const n = Number(meters)
  if (!Number.isFinite(n) || n <= 0) return ''
  if (n < 1000) return `${Math.round(n)} m`
  const km = n / 1000
  return `${km >= 10 ? Math.round(km) : km.toFixed(1)} km`
}

export function serviceClassId(category) {
  const key = String(category || '').toUpperCase()
  if (!key) return 'other'
  if (key.includes('DELUXE')) return 'deluxe'
  if (key.includes('ORDINARY')) return 'ordinary'
  if (/\bAC\b/.test(key) || key.includes('A/C')) return 'ac'
  // Live nearby-buses often returns METRO EXPRESS / EXPRESS — treat as ordinary class.
  if (key.includes('EXPRESS') || key.includes('METRO')) return 'ordinary'
  return 'other'
}

function readFare(option) {
  const amount = Number(option?.fare)
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount) : null
}

function fareChoices(leg) {
  const options = Array.isArray(leg?.fare_options) ? leg.fare_options : []
  return options
    .map((option) => {
      const fareInr = readFare(option)
      if (!fareInr) return null
      const routes = Array.isArray(option.routes) ? option.routes : []
      const matched =
        routes.find((route) => route?.chalo_route_id === leg?.route_id) || routes[0] || null
      const category = String(matched?.service_category || '').trim()
      return {
        fareInr,
        category: titleLabel(category),
        classId: serviceClassId(category),
      }
    })
    .filter(Boolean)
}

function clockLabel(value) {
  const [hour, minute] = String(value || '').split(':').map(Number)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return ''
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  let diff = hour * 60 + minute - nowMin
  if (diff < 0) diff += 24 * 60
  if (diff <= 90) return `${diff} Min`
  const stamp = new Date()
  stamp.setHours(hour, minute, 0, 0)
  return stamp
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    .replace(/\s/g, ' ')
}

function pickFare(choices, filterId) {
  const pool = filterId && filterId !== 'all' ? choices.filter((choice) => choice.classId === filterId) : choices
  if (!pool.length) return null
  return pool.reduce((best, choice) => (choice.fareInr < best.fareInr ? choice : best))
}

export function mapBusRouteCards(list) {
  const items = Array.isArray(list) ? list : []
  return items
    .map((item, index) => {
      const legs = Array.isArray(item?.legs) ? item.legs : []
      const first = legs[0]
      const last = legs[legs.length - 1]
      if (!first) return null
      const choices = legs.flatMap((leg) => fareChoices(leg))
      const routeName = first.route_name || ''
      return {
        id: String(item.itinerary_id || first.trip_id || index),
        code: routeCode(routeName) || 'Bus',
        from: titleLabel(first.from_stop_name || first.from_stage_name || item.origin_stop_name),
        to: titleLabel(last?.to_stop_name || last?.to_stage_name || item.destination_stop_name),
        corridor: routeCorridor(routeName),
        departLabel: clockLabel(first.depart_time || item.depart_time),
        scheduled: Boolean(first.depart_time || item.depart_time),
        routeId: first.route_id || '',
        tripId: first.trip_id || '',
        originStopId: first.from_stop_id || item.origin_stop_id || '',
        destinationStopId: last?.to_stop_id || item.destination_stop_id || '',
        choices,
      }
    })
    .filter(Boolean)
}

const BUS_COLORS = ['#2f6bff', '#e11d2e', '#16a34a', '#eab308', '#7c3aed', '#f97316', '#0ea5e9', '#111827']

function coord(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function busColor(key, index) {
  const raw = String(key || '')
  if (!raw) return BUS_COLORS[index % BUS_COLORS.length]
  let hash = 0
  for (let i = 0; i < raw.length; i += 1) hash = (hash * 31 + raw.charCodeAt(i)) >>> 0
  return BUS_COLORS[hash % BUS_COLORS.length]
}

/** Degrees clockwise from north, boarding stop toward the alighting stop. */
export function routeHeading(fromLat, fromLng, toLat, toLng) {
  if (![fromLat, fromLng, toLat, toLng].every((n) => Number.isFinite(n))) return 0
  const fromLatRad = (fromLat * Math.PI) / 180
  const toLatRad = (toLat * Math.PI) / 180
  const deltaLng = ((toLng - fromLng) * Math.PI) / 180
  const y = Math.sin(deltaLng) * Math.cos(toLatRad)
  const x =
    Math.cos(fromLatRad) * Math.sin(toLatRad) -
    Math.sin(fromLatRad) * Math.cos(toLatRad) * Math.cos(deltaLng)
  return (Math.atan2(y, x) * 180) / Math.PI
}

/**
 * One `/nearby-buses` row → list card and map pin.
 * boarding_stop is where the rider boards; destination_stop is where they alight.
 * eta_minutes and distance_m are from the rider to that boarding stop.
 */
export function mapNearbyBus(item, index = 0) {
  const board = item?.boarding_stop || null
  const dest = item?.destination_stop || null
  // show_all can return vehicles with no boarding/destination — skip those for SRP.
  if (!board?.stop_id || !dest?.stop_id) return null
  const fare = Number(item?.fare)
  const eta = Number(item?.eta_minutes)
  const distanceM = Number(item?.distance_m)
  // Prefer live vehicle coords when the API sends them; else boarding stop.
  const lat =
    coord(item?.lat) ??
    coord(item?.vehicle_lat) ??
    coord(item?.current_lat) ??
    coord(board.stop_lat)
  const lng =
    coord(item?.lon) ??
    coord(item?.lng) ??
    coord(item?.vehicle_lon) ??
    coord(item?.current_lon) ??
    coord(board.stop_lon)
  const destLat = coord(dest.stop_lat)
  const destLng = coord(dest.stop_lon)
  const category = titleLabel(item?.service_category)
  const fareInr = Number.isFinite(fare) && fare > 0 ? Math.round(fare) : null
  const classId = serviceClassId(item?.service_category)
  const etaMinutes = Number.isFinite(eta) && eta >= 0 ? Math.round(eta) : null
  const vehicleId = String(item?.vehicle_id || '')
  const id = vehicleId || String(item?.trip_id || index)
  const liveHeading = coord(item?.heading) ?? coord(item?.bearing)
  return {
    id,
    vehicleId,
    tripId: String(item?.trip_id || ''),
    routeId: String(item?.chalo_route_id || ''),
    routeName: String(item?.route_name || ''),
    code: routeCode(item?.route_name) || 'Bus',
    corridor: routeCorridor(item?.route_name),
    from: titleLabel(board.stop_name),
    to: titleLabel(dest.stop_name),
    originStopId: String(board.stop_id || ''),
    destinationStopId: String(dest.stop_id || ''),
    lat,
    lng,
    destLat,
    destLng,
    heading: liveHeading ?? routeHeading(lat, lng, destLat, destLng),
    fareInr,
    distanceM: Number.isFinite(distanceM) && distanceM > 0 ? distanceM : null,
    distanceLabel: formatDistance(distanceM),
    etaMinutes,
    departLabel: etaMinutes != null ? `${etaMinutes} Min` : '',
    scheduled: false,
    category,
    color: busColor(id, index),
    choices: fareInr ? [{ fareInr, category, classId }] : [],
  }
}

export function cardForFilter(card, filterId) {
  const fare = pickFare(card.choices, filterId)
  if (filterId !== 'all' && !fare) return null
  const shown = fare || card.choices[0] || null
  return {
    ...card,
    fareInr: shown?.fareInr ?? null,
    category: shown?.category || '',
  }
}
