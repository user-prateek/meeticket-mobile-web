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
      if (status === 'OK' && results?.length) {
        resolve(results)
        return
      }
      if (status === 'ZERO_RESULTS') {
        resolve(null)
        return
      }
      reject(new Error(`Geocode failed (${status})`))
    })
  })

  if (!response?.length) return null

  const primary = response[0]
  const components = primary.address_components || []
  const city =
    components.find((c) => c.types.includes('locality'))?.long_name ||
    components.find((c) => c.types.includes('administrative_area_level_2'))?.long_name ||
    ''

  return {
    address: primary.formatted_address || '',
    placeId: primary.place_id || '',
    city,
    shortName: shortNameFromGeocodeResults(response),
  }
}

const TRANSIT_RESULT_TYPES = [
  'subway_station',
  'transit_station',
  'train_station',
  'bus_station',
]

const SHORT_NAME_TYPES = [
  'point_of_interest',
  'establishment',
  'premise',
  'neighborhood',
  'sublocality_level_1',
  'sublocality',
  'sublocality_level_2',
  'route',
]

function componentName(result, type) {
  return result?.address_components?.find((c) => c.types?.includes(type))?.long_name || ''
}

function shortNameFromGeocodeResults(results) {
  if (!Array.isArray(results) || !results.length) return ''

  // Prefer an explicit transit-station result (Miyapur metro, not Hafeezpet neighborhood).
  for (const result of results) {
    if (result.types?.some((type) => TRANSIT_RESULT_TYPES.includes(type))) {
      return shortNameFromFormattedAddress(result.formatted_address)
    }
  }

  for (const type of SHORT_NAME_TYPES) {
    for (const result of results) {
      const name = componentName(result, type)
      if (name) return name
    }
  }

  return shortNameFromFormattedAddress(results[0]?.formatted_address)
}

/** @deprecated use shortNameFromGeocodeResults — kept for single-result callers */
export function shortNameFromGeocode(result) {
  return shortNameFromGeocodeResults(result ? [result] : [])
}

export function shortNameFromFormattedAddress(address) {
  const first = String(address || '')
    .split(',')[0]
    .trim()
  if (!first) return ''
  return first
    .replace(/\s+\d{6}\s*$/u, '')
    .replace(/\s+Telangana(?:\s+state)?(?:\s+India)?$/iu, '')
    .replace(/\s+Hyderabad$/iu, '')
    .trim()
}

const shortNameCache = new Map()

function coordCacheKey(lat, lon) {
  return `${Number(lat).toFixed(5)},${Number(lon).toFixed(5)}`
}

/** Short place label for a lat/lng (cached). */
export async function reverseGeocodeShortName(lat, lon, { signal } = {}) {
  const key = coordCacheKey(lat, lon)
  if (shortNameCache.has(key)) return shortNameCache.get(key)

  const result = await reverseGeocodeLatLng(lat, lon, { signal })
  const name = result?.shortName || ''
  if (name) shortNameCache.set(key, name)
  return name
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
