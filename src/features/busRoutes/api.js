import { GetRequest } from '../../api/client'
import { tgsrtcBaseUrl, urls } from '../../api/config'
import { fetchMockCheckout } from './mockApi'
import { mapNearbyBus } from './mapBusRoutes'
import { mapVehicleEta } from './mapVehicleEta'

const NEARBY_DEFAULTS = {
  radius_km: 5,
  walk_km: 1,
  destination_radius_km: 1,
  max_boarding_stops: 3,
  max_destination_stops: 3,
  eta_provider: 'osrm',
}

/**
 * Live TGSRTC nearby-buses → list cards + map pins.
 * Requires trip from/to lat/lon (same query as /journey).
 */
export async function fetchBusRouteOptions(trip, { signal } = {}) {
  const url = urls.nearbyBuses
  if (!url) throw new Error('TGSRTC API is not configured')
  if (
    trip?.fromLat == null ||
    trip?.fromLon == null ||
    trip?.toLat == null ||
    trip?.toLon == null
  ) {
    throw new Error('from_lat, from_lon, to_lat and to_lon are required')
  }

  const payload = {
    lat: trip.fromLat,
    lon: trip.fromLon,
    destination_lat: trip.toLat,
    destination_lon: trip.toLon,
    ...NEARBY_DEFAULTS,
  }

  const data = await GetRequest(url, payload, { signal })
  const rows = Array.isArray(data) ? data : Array.isArray(data?.buses) ? data.buses : []
  return rows.map((item, index) => mapNearbyBus(item, index)).filter(Boolean)
}

/**
 * Live vehicle ETA + stop list for route detail.
 * GET /vehicles/{vehicleId}/eta?cust_lat&cust_lon&drop_stop_id&eta_provider=osrm
 */
export async function fetchRouteDetail(
  { vehicleId, custLat, custLon, dropStopId },
  { signal } = {},
) {
  const id = String(vehicleId || '').trim()
  if (!id) throw new Error('Vehicle is missing')
  if (!tgsrtcBaseUrl) throw new Error('TGSRTC API is not configured')
  if (custLat == null || custLon == null) {
    throw new Error('from_lat and from_lon are required')
  }
  if (!dropStopId) throw new Error('Drop stop is missing')

  const data = await GetRequest(
    `${tgsrtcBaseUrl}/vehicles/${encodeURIComponent(id)}/eta?`,
    {
      cust_lat: custLat,
      cust_lon: custLon,
      drop_stop_id: dropStopId,
      eta_provider: 'osrm',
    },
    { signal },
  )
  return mapVehicleEta(data)
}

/** Summary and ticket for the selected bus. Mocked until checkout APIs arrive. */
export function fetchRouteCheckout(routeId, options) {
  return fetchMockCheckout(routeId, options)
}
