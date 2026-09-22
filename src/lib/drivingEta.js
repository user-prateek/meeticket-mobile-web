import { loadGoogleMaps } from './googleMaps'
import { isOsmMap } from './mapProvider'
import { fetchOsmDrivingRoute } from './osmMaps'

/**
 * Driving duration (minutes) between two points.
 * Google Directions when `VITE_MAP_PROVIDER=google`; OSRM when `osm`.
 * Used for first-mile cab ExpectedEndTime on order create.
 */
export async function fetchDrivingEtaMinutes({ fromLat, fromLng, toLat, toLng }) {
  if (isOsmMap()) {
    const route = await fetchOsmDrivingRoute({ fromLat, fromLng, toLat, toLng })
    if (!Number.isFinite(route.durationSec) || route.durationSec <= 0) {
      throw new Error('OSRM returned no duration')
    }
    return Math.max(1, Math.ceil(route.durationSec / 60))
  }

  const gmaps = await loadGoogleMaps()

  return new Promise((resolve, reject) => {
    const service = new gmaps.DirectionsService()
    service.route(
      {
        origin: { lat: Number(fromLat), lng: Number(fromLng) },
        destination: { lat: Number(toLat), lng: Number(toLng) },
        travelMode: gmaps.TravelMode.DRIVING,
        provideRouteAlternatives: false,
      },
      (result, status) => {
        if (status !== 'OK' || !result?.routes?.[0]?.legs?.[0]) {
          reject(new Error(`Directions failed (${status})`))
          return
        }

        const seconds = result.routes[0].legs[0].duration?.value
        if (!Number.isFinite(seconds) || seconds <= 0) {
          reject(new Error('Directions returned no duration'))
          return
        }

        resolve(Math.max(1, Math.ceil(seconds / 60)))
      },
    )
  })
}
