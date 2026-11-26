import { GetRequest } from '../../api/client'
import { tgsrtcBaseUrl, urls } from '../../api/config'
import { mapNearbyBus } from './mapBusRoutes'
import { mapRouteCheckout } from './mapCheckout'
import { mapVehicleEta } from './mapVehicleEta'

const NEARBY_DEFAULTS = {
  /** false = use lat/lon + destination; true = every active vehicle (ignores coords). */
  show_all: false,
  filter_by_destination: true,
  radius_km: 5,
  walk_km: 1,
  destination_radius_km: 1,
  max_boarding_stops: 3,
  max_destination_stops: 3,
  eta_provider: 'osrm',
}

/**
 * Live TGSRTC nearby-buses → list cards + map pins.
 * Requires trip from/to lat/lon unless show_all is true.
 */
export async function fetchBusRouteOptions(trip, { signal, showAll } = {}) {
  const url = urls.nearbyBuses
  if (!url) throw new Error('TGSRTC API is not configured')

  const show_all = Boolean(showAll ?? trip?.showAll ?? NEARBY_DEFAULTS.show_all)
  if (
    !show_all &&
    (trip?.fromLat == null ||
      trip?.fromLon == null ||
      trip?.toLat == null ||
      trip?.toLon == null)
  ) {
    throw new Error('from_lat, from_lon, to_lat and to_lon are required')
  }

  const payload = {
    ...NEARBY_DEFAULTS,
    show_all,
    ...(show_all
      ? {}
      : {
          lat: trip.fromLat,
          lon: trip.fromLon,
          destination_lat: trip.toLat,
          destination_lon: trip.toLon,
        }),
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

/**
 * Journey summary: vehicle ETA + previous-page query (fare/code/places/stops).
 */
export async function fetchRouteCheckout(query, { signal } = {}) {
  const detail = await fetchRouteDetail(
    {
      vehicleId: query.vehicleId,
      custLat: query.fromLat,
      custLon: query.fromLon,
      dropStopId: query.dropStopId || query.toStopId,
    },
    { signal },
  )
  return mapRouteCheckout(detail, query)
}
