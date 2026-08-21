/**
 * Trip query contract for the web `/journey` screen.
 *
 * Preferred order (lat/lon first, short place names after):
 *   from_lat, from_lon, to_lat, to_lon,
 *   from, to,
 *   access_mode, egress_mode, candidates
 *
 * `from` / `to` should be a short place name (first line / landmark), not the full
 * address with area, city, state, and pincode.
 *
 * Example (Swagger-verified):
 *   /journey?from_lat=17.404897799573&from_lon=78.4655127838186
 *     &to_lat=17.4184128072581&to_lon=78.49696327420617
 *     &access_mode=walk&egress_mode=walk&candidates=2
 */

export const DEMO_TRIP_QUERY = {
  from_lat: '17.404897799573',
  from_lon: '78.4655127838186',
  to_lat: '17.4184128072581',
  to_lon: '78.49696327420617',
  from: 'Lutheran Church',
  to: '4m hotel Bholakpur',
  candidates: '2',
  access_mode: 'walk',
  egress_mode: 'walk',
}

function parseCoord(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function firstParam(params, keys) {
  for (const key of keys) {
    const value = params.get(key)
    if (value != null && value !== '') return value
  }
  return null
}

function parseCandidates(value) {
  const n = Number(value)
  return n === 2 ? 2 : 1
}

/** True when URL includes all four coordinates (no demo fallback). */
export function hasRequiredTripParams(source) {
  const params =
    source instanceof URLSearchParams
      ? source
      : new URLSearchParams(source ?? '')

  const fromLat = parseCoord(firstParam(params, ['from_lat', 'fromLat']))
  const fromLon = parseCoord(firstParam(params, ['from_lon', 'fromLon', 'fromLng']))
  const toLat = parseCoord(firstParam(params, ['to_lat', 'toLat']))
  const toLon = parseCoord(firstParam(params, ['to_lon', 'toLon', 'toLng']))
  return fromLat != null && fromLon != null && toLat != null && toLon != null
}

/**
 * Short place label for UI / query string.
 * Uses first line, then first comma segment; drops trailing pincode.
 */
export function shortPlaceLabel(value) {
  if (!value) return ''
  const firstLine = String(value).split(/\r?\n/)[0].trim()
  let name = firstLine.split(',')[0].trim()
  name = name.replace(/\s+\d{6}\s*$/u, '').trim()
  // Drop trailing "Hyderabad Telangana state India" style noise if still glued on
  name = name
    .replace(/\s+Telangana(?:\s+state)?(?:\s+India)?$/iu, '')
    .replace(/\s+Hyderabad$/iu, '')
    .trim()
  return name || firstLine
}

/** Build a trip object from URLSearchParams or a plain object. */
export function parseTripQuery(source) {
  const params =
    source instanceof URLSearchParams
      ? source
      : new URLSearchParams(source ?? '')

  const fromPlace = shortPlaceLabel(
    firstParam(params, ['from', 'fromPlace']) || DEMO_TRIP_QUERY.from,
  )
  const toPlace = shortPlaceLabel(firstParam(params, ['to', 'toPlace']) || DEMO_TRIP_QUERY.to)
  const fromLat =
    parseCoord(firstParam(params, ['from_lat', 'fromLat'])) ?? Number(DEMO_TRIP_QUERY.from_lat)
  const fromLon =
    parseCoord(firstParam(params, ['from_lon', 'fromLon', 'fromLng'])) ??
    Number(DEMO_TRIP_QUERY.from_lon)
  const toLat = parseCoord(firstParam(params, ['to_lat', 'toLat'])) ?? Number(DEMO_TRIP_QUERY.to_lat)
  const toLon =
    parseCoord(firstParam(params, ['to_lon', 'toLon', 'toLng'])) ?? Number(DEMO_TRIP_QUERY.to_lon)
  const accessMode = firstParam(params, ['access_mode', 'accessMode']) || DEMO_TRIP_QUERY.access_mode
  const egressMode = firstParam(params, ['egress_mode', 'egressMode']) || DEMO_TRIP_QUERY.egress_mode
  const candidates = parseCandidates(firstParam(params, ['candidates']) ?? DEMO_TRIP_QUERY.candidates)

  return {
    fromPlace,
    toPlace,
    fromLat,
    fromLon,
    fromLng: fromLon,
    toLat,
    toLon,
    toLng: toLon,
    accessMode,
    egressMode,
    candidates,
  }
}

/** Serialize trip: lat/lon first, then short from/to names. */
export function tripToSearchParams(trip) {
  const params = new URLSearchParams()
  if (trip.fromLat != null) params.set('from_lat', String(trip.fromLat))
  if (trip.fromLon != null || trip.fromLng != null) {
    params.set('from_lon', String(trip.fromLon ?? trip.fromLng))
  }
  if (trip.toLat != null) params.set('to_lat', String(trip.toLat))
  if (trip.toLon != null || trip.toLng != null) {
    params.set('to_lon', String(trip.toLon ?? trip.toLng))
  }
  if (trip.fromPlace) params.set('from', shortPlaceLabel(trip.fromPlace))
  if (trip.toPlace) params.set('to', shortPlaceLabel(trip.toPlace))
  params.set('access_mode', trip.accessMode || 'walk')
  params.set('egress_mode', trip.egressMode || 'walk')
  params.set('candidates', String(trip.candidates === 2 ? 2 : 1))
  return params
}

export function tripToSearch(trip) {
  const q = tripToSearchParams(trip).toString()
  return q ? `?${q}` : ''
}

export function demoJourneyPath() {
  return `/journey${tripToSearch(parseTripQuery(DEMO_TRIP_QUERY))}`
}
