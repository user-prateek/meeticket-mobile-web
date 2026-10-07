/**
 * Trip query contract for the web `/journey` screen.
 *
 * Preferred order (lat/lon first, short place names after):
 *   from_lat, from_lon, to_lat, to_lon,
 *   from, to,
 *   mode, access_mode, egress_mode, candidates
 *
 * `mode` — product mode: 1 metro only, 2 TGSRTC only, 3 multi-mode (default).
 *
 * `from` / `to` should be a short place name (first line / landmark), not the full
 * address with area, city, state, and pincode.
 *
 * Example:
 *   /journey?from_lat=…&from_lon=…&to_lat=…&to_lon=…
 *     &from=…&to=…&mode=3&access_mode=walk&egress_mode=walk&candidates=2
 */

import {
  JOURNEY_MODE,
  JOURNEY_MODE_DEFAULT,
  parseJourneyMode,
} from '../constants/journeyMode'

const DEFAULT_ACCESS_MODE = 'walk'
const DEFAULT_EGRESS_MODE = 'walk'
const DEFAULT_CANDIDATES = '2'
const JOURNEY_MODE_STORAGE_KEY = 'mt:journey-mode'

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

function searchParamsFrom(source) {
  if (source instanceof URLSearchParams) return source
  return new URLSearchParams(source ?? '')
}

/** Persist product `mode=1|2|3` from the entry URL so it survives later query rewrites. */
export function captureJourneyModeFromSearch(source) {
  const params = searchParamsFrom(source)
  const raw = firstParam(params, ['mode'])
  const n = Number(raw)
  if (n !== JOURNEY_MODE.METRO && n !== JOURNEY_MODE.TGSRTC && n !== JOURNEY_MODE.MULTI) {
    return getCapturedJourneyMode()
  }
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(JOURNEY_MODE_STORAGE_KEY, String(n))
  }
  return n
}

export function getCapturedJourneyMode() {
  if (typeof sessionStorage === 'undefined') return null
  const n = Number(sessionStorage.getItem(JOURNEY_MODE_STORAGE_KEY))
  if (n === JOURNEY_MODE.METRO || n === JOURNEY_MODE.TGSRTC || n === JOURNEY_MODE.MULTI) {
    return n
  }
  return null
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
  const mode = parseJourneyMode(
    firstParam(params, ['mode']) ?? getCapturedJourneyMode(),
  )
  const showCab = firstParam(params, ['sc', 'show_cab', 'showcab']) === '1'

  return {
    fromPlace,
    toPlace,
    fromLat,
    fromLon,
    fromLng: fromLon,
    toLat,
    toLon,
    toLng: toLon,
    mode,
    accessMode,
    egressMode,
    candidates,
    showCab,
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
  params.set('mode', String(parseJourneyMode(trip.mode ?? JOURNEY_MODE_DEFAULT)))
  params.set('access_mode', trip.accessMode || DEFAULT_ACCESS_MODE)
  params.set('egress_mode', trip.egressMode || DEFAULT_EGRESS_MODE)
  params.set('candidates', String(trip.candidates === 2 ? 2 : 1))
  if (trip.showCab) params.set('sc', '1')
  return params
}

export function tripToSearch(trip) {
  const q = tripToSearchParams(trip).toString()
  return q ? `?${q}` : ''
}

/**
 * Cab-only entry (`/ride`, `/cab?direct=1`) — coords + place names only.
 * Omits product `mode`, access/egress, candidates, and metro token (`mbt`).
 */
export function tripToCabSearchParams(trip) {
  const params = new URLSearchParams()
  if (!trip) return params
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
  return params
}

export function tripToCabSearch(trip) {
  const q = tripToCabSearchParams(trip).toString()
  return q ? `?${q}` : ''
}

/** Default entry when no trip query is present — JourneyPage shows the missing-params state. */
export function demoJourneyPath() {
  return '/journey'
}
