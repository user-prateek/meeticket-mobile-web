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
 * Example:
 *   /journey?from_lat=…&from_lon=…&to_lat=…&to_lon=…
 *     &from=…&to=…&access_mode=walk&egress_mode=walk&candidates=2
 */

const DEFAULT_ACCESS_MODE = 'walk'
const DEFAULT_EGRESS_MODE = 'walk'
const DEFAULT_CANDIDATES = '2'

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

/** True when URL includes all four coordinates. */
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

/** Build a trip object from URLSearchParams or a plain object. Coords come from the URL only. */
export function parseTripQuery(source) {
  const params =
    source instanceof URLSearchParams
      ? source
      : new URLSearchParams(source ?? '')

  const fromPlace = shortPlaceLabel(firstParam(params, ['from', 'fromPlace']) || '')
  const toPlace = shortPlaceLabel(firstParam(params, ['to', 'toPlace']) || '')
  const fromLat = parseCoord(firstParam(params, ['from_lat', 'fromLat']))
  const fromLon = parseCoord(firstParam(params, ['from_lon', 'fromLon', 'fromLng']))
  const toLat = parseCoord(firstParam(params, ['to_lat', 'toLat']))
  const toLon = parseCoord(firstParam(params, ['to_lon', 'toLon', 'toLng']))
  const accessMode =
    firstParam(params, ['access_mode', 'accessMode']) || DEFAULT_ACCESS_MODE
  const egressMode =
    firstParam(params, ['egress_mode', 'egressMode']) || DEFAULT_EGRESS_MODE
  const candidates = parseCandidates(
    firstParam(params, ['candidates']) ?? DEFAULT_CANDIDATES,
  )

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
  params.set('access_mode', trip.accessMode || DEFAULT_ACCESS_MODE)
  params.set('egress_mode', trip.egressMode || DEFAULT_EGRESS_MODE)
  params.set('candidates', String(trip.candidates === 2 ? 2 : 1))
  return params
}

export function tripToSearch(trip) {
  const q = tripToSearchParams(trip).toString()
  return q ? `?${q}` : ''
}

/** Default entry when no trip query is present — JourneyPage shows the missing-params state. */
export function demoJourneyPath() {
  return '/journey'
}
