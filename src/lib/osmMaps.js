/** OpenStreetMap tiles + public OSRM routing + Nominatim reverse geocode. */

export const OSM_TILE_URL =
  String(import.meta.env.VITE_OSM_TILE_URL || '').trim() ||
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

export const OSM_ATTRIBUTION =
  String(import.meta.env.VITE_OSM_TILE_ATTRIBUTION || '').trim() ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

const OSM_ROUTER_BASE = (
  String(import.meta.env.VITE_OSM_ROUTER_URL || '').trim() || 'https://router.project-osrm.org'
).replace(/\/$/, '')

const OSM_NOMINATIM_BASE = (
  String(import.meta.env.VITE_OSM_NOMINATIM_URL || '').trim() ||
  'https://nominatim.openstreetmap.org'
).replace(/\/$/, '')

let leafletPromise = null

/** Load Leaflet once (CSS + module). Safe to call from preload. */
export function loadLeaflet() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('OpenStreetMap requires a browser'))
  }
  if (leafletPromise) return leafletPromise

  leafletPromise = Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')])
    .then(([mod]) => {
      const L = mod.default || mod
      // We only use DivIcon HTML markers — skip default pin asset paths (broken under Vite).
      if (L.Icon?.Default?.prototype) {
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: '',
          iconUrl: '',
          shadowUrl: '',
        })
      }
      return L
    })
    .catch((error) => {
      leafletPromise = null
      throw error
    })

  return leafletPromise
}

export function preloadOsmMaps() {
  loadLeaflet().catch(() => {})
}

function abortError() {
  const err = new Error('Aborted')
  err.name = 'AbortError'
  return err
}

function readJson(response, label) {
  if (!response.ok) {
    throw new Error(`${label} failed (${response.status})`)
  }
  return response.json()
}

/**
 * Driving route via OSRM.
 * Returns { path, distanceM, durationSec }.
 */
export async function fetchOsmDrivingRoute({ fromLat, fromLng, toLat, toLng, signal } = {}) {
  const fromLon = fromLng
  const toLon = toLng
  if ([fromLat, fromLon, toLat, toLon].some((n) => !Number.isFinite(Number(n)))) {
    throw new Error('OSRM route needs origin and destination coordinates')
  }
  if (signal?.aborted) throw abortError()

  const coords = `${Number(fromLon)},${Number(fromLat)};${Number(toLon)},${Number(toLat)}`
  const url = `${OSM_ROUTER_BASE}/route/v1/driving/${coords}?overview=full&geometries=geojson`

  const response = await fetch(url, { signal })
  const data = await readJson(response, 'OSRM')
  const route = data?.routes?.[0]
  if (data?.code !== 'Ok' || !route?.geometry?.coordinates?.length) {
    throw new Error(`OSRM route failed (${data?.code || 'empty'})`)
  }

  const path = route.geometry.coordinates.map(([lng, lat]) => ({
    lat: Number(lat),
    lng: Number(lng),
  }))

  return {
    path,
    distanceM: Number(route.distance) || 0,
    durationSec: Number(route.duration) || 0,
  }
}

function osmShortName(data) {
  const address = data?.address && typeof data.address === 'object' ? data.address : {}
  const name =
    address.neighbourhood ||
    address.suburb ||
    address.quarter ||
    address.road ||
    address.village ||
    address.town ||
    address.city_district ||
    ''
  if (name) return String(name).trim()
  const first = String(data?.display_name || '')
    .split(',')[0]
    .trim()
  return first
}

/**
 * Reverse-geocode via Nominatim. Same shape as Google geocode helper.
 */
export async function reverseGeocodeOsm(lat, lon, { signal } = {}) {
  if (lat == null || lon == null) return null
  if (signal?.aborted) throw abortError()

  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(lat),
    lon: String(lon),
    zoom: '18',
    addressdetails: '1',
  })
  const response = await fetch(`${OSM_NOMINATIM_BASE}/reverse?${params}`, {
    signal,
    headers: { Accept: 'application/json' },
  })
  const data = await readJson(response, 'Nominatim')
  if (!data || data.error) return null

  const addressObj = data.address && typeof data.address === 'object' ? data.address : {}
  const city = addressObj.city || addressObj.town || addressObj.village || ''

  return {
    address: data.display_name || '',
    placeId: data.osm_id != null ? String(data.osm_id) : '',
    city,
    shortName: osmShortName(data),
  }
}

/** Leaflet DivIcon wrapping a React-mounted host node. */
export function osmDivIcon(L, host, className) {
  return L.divIcon({
    className: className || 'mt-map-marker-host',
    html: host,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}
