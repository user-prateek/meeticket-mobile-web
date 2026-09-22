/**
 * In-app map provider. Set `VITE_MAP_PROVIDER` at build/dev time.
 *
 *   osm    — OpenStreetMap tiles (Leaflet) + OSRM + Nominatim (default)
 *   google — Google Maps JS + Directions + Geocoder (paid after free cap)
 *
 * Aliases for osm: openstreet, openstreetmap, leaflet
 * Aliases for google: gmaps, google-maps
 */

export const MAP_PROVIDERS = {
  GOOGLE: 'google',
  OSM: 'osm',
}

function normalizeProvider(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase()
  if (raw === 'google' || raw === 'gmaps' || raw === 'google-maps') {
    return MAP_PROVIDERS.GOOGLE
  }
  return MAP_PROVIDERS.OSM
}

export const MAP_PROVIDER = normalizeProvider(
  import.meta.env.VITE_MAP_PROVIDER || MAP_PROVIDERS.OSM,
)

export function isOsmMap() {
  return MAP_PROVIDER === MAP_PROVIDERS.OSM
}

export function isGoogleMap() {
  return MAP_PROVIDER === MAP_PROVIDERS.GOOGLE
}

export function isMapConfigured() {
  if (isOsmMap()) return true
  return Boolean(String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim())
}

/** Preload the active provider (Google JS or Leaflet). No-op if Google key is missing. */
export function preloadMap() {
  if (isOsmMap()) {
    import('./osmMaps').then((mod) => mod.preloadOsmMaps()).catch(() => {})
    return
  }
  import('./googleMaps').then((mod) => mod.preloadGoogleMaps()).catch(() => {})
}
