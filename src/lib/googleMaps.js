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

/**
 * Coords for /cab map from access (pickup) or egress (drop).
 * Falls back to trip A→B if mile coords are missing.
 */
export function resolveCabMapPoints({ serviceId, mile, trip, fromLabel, toLabel }) {
  const isDrop = serviceId === 'drop'

  const fromLat = mile?.fromLat ?? (isDrop ? null : trip?.fromLat)
  const fromLon = mile?.fromLon ?? (isDrop ? null : trip?.fromLon)
  const toLat = mile?.toLat ?? (isDrop ? trip?.toLat : null)
  const toLon = mile?.toLon ?? (isDrop ? trip?.toLon : null)

  const from = {
    lat: Number(fromLat ?? trip?.fromLat),
    lng: Number(fromLon ?? trip?.fromLon ?? trip?.fromLng),
    label: fromLabel || mile?.fromLabel || trip?.fromPlace || 'Start',
  }
  const to = {
    lat: Number(toLat ?? trip?.toLat),
    lng: Number(toLon ?? trip?.toLon ?? trip?.toLng),
    label: toLabel || mile?.toLabel || trip?.toPlace || 'End',
  }

  const valid =
    Number.isFinite(from.lat) &&
    Number.isFinite(from.lng) &&
    Number.isFinite(to.lat) &&
    Number.isFinite(to.lng)

  return valid ? { from, to } : null
}
