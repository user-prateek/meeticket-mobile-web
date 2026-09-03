/** Google Maps JS API key — set in `.env` as VITE_GOOGLE_MAPS_API_KEY=… */
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

let loadPromise = null

/**
 * Preload Maps JS (classic loader — `google.maps.Map` is a real constructor after load).
 * Safe to call early (e.g. when entering /cab).
 */
export function loadGoogleMaps(apiKey = GOOGLE_MAPS_API_KEY) {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps requires a browser'))
  }
  if (!apiKey) {
    return Promise.reject(new Error('Missing VITE_GOOGLE_MAPS_API_KEY'))
  }

  if (window.google?.maps?.Map && typeof window.google.maps.Map === 'function') {
    return Promise.resolve(window.google.maps)
  }

  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    const finish = () => {
      const gmaps = window.google?.maps
      if (gmaps?.Map && typeof gmaps.Map === 'function') {
        resolve(gmaps)
        return
      }
      loadPromise = null
      reject(new Error('Google Maps loaded but Map is unavailable'))
    }

    const existing = document.querySelector('script[data-google-maps]')
    if (existing) {
      if (window.google?.maps?.Map) {
        finish()
        return
      }
      existing.addEventListener('load', finish)
      existing.addEventListener('error', () => {
        loadPromise = null
        reject(new Error('Failed to load Google Maps'))
      })
      return
    }

    const script = document.createElement('script')
    // No `loading=async` — that requires importLibrary and breaks `new google.maps.Map`.
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`
    script.async = true
    script.defer = true
    script.dataset.googleMaps = 'true'
    script.onload = finish
    script.onerror = () => {
      loadPromise = null
      reject(new Error('Failed to load Google Maps'))
    }
    document.head.appendChild(script)
  })

  return loadPromise
}

/** Start loading in the background (no throw if key missing). */
export function preloadGoogleMaps() {
  if (!GOOGLE_MAPS_API_KEY) return
  loadGoogleMaps().catch(() => {})
}

function readCoord(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function boardingStationLabel(journey, leg) {
  const firstTransit = (journey?.segments || []).find(
    (seg) => seg?.mode === 'metro' || seg?.mode === 'bus',
  )
  return journey?.originStation || leg?.toLabel || firstTransit?.from || 'Station'
}

/** Read access/egress coords (mapped camelCase or API snake_case). */
function readMileCoords(leg, raw) {
  const src = leg || {}
  const fallback = raw || {}
  return {
    fromLat: readCoord(
      src.fromLat ?? src.from_lat ?? fallback.fromLat ?? fallback.from_lat,
    ),
    fromLon: readCoord(
      src.fromLon ?? src.from_lon ?? fallback.fromLon ?? fallback.from_lon,
    ),
    toLat: readCoord(src.toLat ?? src.to_lat ?? fallback.toLat ?? fallback.to_lat),
    toLon: readCoord(src.toLon ?? src.to_lon ?? fallback.toLon ?? fallback.to_lon),
  }
}

/**
 * Cab map from the selected journey option's access/egress — not Google Places.
 *
 * Journey API (selected option):
 *   access.from_lat/lon  → user current location
 *   access.to_lat/lon    → boarding station for that option (e.g. Miyapur)
 *   egress.from_lat/lon  → alighting station
 *   egress.to_lat/lon    → user destination
 *
 * Pickup map: access.from → access.to  (user → chosen station)
 * Drop map:   egress.from → egress.to
 */
export function resolveCabMapPoints({ serviceId, mile, trip, journey, fromLabel, toLabel }) {
  const isDrop = serviceId === 'drop'
  const leg = mile || (isDrop ? journey?.egress : journey?.access)
  const raw = isDrop ? journey?.raw?.egress : journey?.raw?.access
  const { fromLat: legFromLat, fromLon: legFromLon, toLat: legToLat, toLon: legToLon } =
    readMileCoords(leg, raw)

  const tripFromLat = readCoord(trip?.fromLat)
  const tripFromLon = readCoord(trip?.fromLon ?? trip?.fromLng)
  const tripToLat = readCoord(trip?.toLat)
  const tripToLon = readCoord(trip?.toLon ?? trip?.toLng)

  let fromLat
  let fromLon
  let toLat
  let toLon
  let resolvedFromLabel
  let resolvedToLabel

  if (isDrop) {
    // egress.from_* = alighting station, egress.to_* = user destination
    fromLat = legFromLat
    fromLon = legFromLon
    toLat = legToLat ?? tripToLat
    toLon = legToLon ?? tripToLon
    resolvedFromLabel =
      fromLabel || leg?.fromLabel || journey?.destinationStation || 'Station'
    resolvedToLabel = toLabel || leg?.toLabel || trip?.toPlace || 'Drop'
  } else {
    // access.from_* = user location, access.to_* = boarding station (Miyapur, …)
    // Never use trip destination / egress here.
    fromLat = legFromLat ?? tripFromLat
    fromLon = legFromLon ?? tripFromLon
    toLat = legToLat
    toLon = legToLon
    resolvedFromLabel = fromLabel || leg?.fromLabel || trip?.fromPlace || 'Pickup'
    resolvedToLabel = toLabel || boardingStationLabel(journey, leg)
  }

  if (fromLat == null || fromLon == null || toLat == null || toLon == null) {
    if (import.meta.env.DEV) {
      console.warn('[cab-map] missing coords for map', {
        serviceId,
        fromLat,
        fromLon,
        toLat,
        toLon,
        access: journey?.access,
        egress: journey?.egress,
        tripFrom: { lat: tripFromLat, lng: tripFromLon },
        tripTo: { lat: tripToLat, lng: tripToLon },
      })
    }
    return null
  }

  return {
    from: { lat: fromLat, lng: fromLon, label: resolvedFromLabel },
    to: { lat: toLat, lng: toLon, label: resolvedToLabel },
  }
}
