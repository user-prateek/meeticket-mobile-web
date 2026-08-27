import { loadGoogleMaps } from './googleMaps'

/**
 * Reverse-geocode lat/lng via Maps JavaScript Geocoder (browser-safe).
 * Do not call maps.googleapis.com/maps/api/geocode/json from the browser — that REST
 * endpoint has no CORS and will fail in DevTools as "CORS error".
 *
 * Returns { address, placeId, city } or null on failure.
 */
export async function reverseGeocodeLatLng(lat, lon, { signal } = {}) {
  if (lat == null || lon == null) return null
  if (signal?.aborted) {
    const err = new Error('Aborted')
    err.name = 'AbortError'
    throw err
  }

  const gmaps = await loadGoogleMaps()
  if (signal?.aborted) {
    const err = new Error('Aborted')
    err.name = 'AbortError'
    throw err
  }

  const geocoder = new gmaps.Geocoder()

  const response = await new Promise((resolve, reject) => {
    const onAbort = () => {
      const err = new Error('Aborted')
      err.name = 'AbortError'
      reject(err)
    }
    if (signal) signal.addEventListener('abort', onAbort, { once: true })

    geocoder.geocode({ location: { lat: Number(lat), lng: Number(lon) } }, (results, status) => {
      if (signal) signal.removeEventListener('abort', onAbort)
      if (status === 'OK' && results?.[0]) {
        resolve(results[0])
        return
      }
      if (status === 'ZERO_RESULTS') {
        resolve(null)
        return
      }
      reject(new Error(`Geocode failed (${status})`))
    })
  })

  if (!response) return null

  const components = response.address_components || []
  const city =
    components.find((c) => c.types.includes('locality'))?.long_name ||
    components.find((c) => c.types.includes('administrative_area_level_2'))?.long_name ||
    ''

  return {
    address: response.formatted_address || '',
    placeId: response.place_id || '',
    city,
  }
}

/** Great-circle distance in km. */
export function haversineKm(aLat, aLon, bLat, bLon) {
  const toRad = (d) => (d * Math.PI) / 180
  const R = 6371
  const dLat = toRad(bLat - aLat)
  const dLon = toRad(bLon - aLon)
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}
