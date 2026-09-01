import { loadGoogleMaps } from './googleMaps'

/**
 * Driving duration (minutes) between two points via Google Directions API.
 * Used for first-mile cab ExpectedEndTime on order create.
 */
export async function fetchDrivingEtaMinutes({ fromLat, fromLng, toLat, toLng }) {
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
