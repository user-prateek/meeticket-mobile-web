import { GetRequest } from '../../api/client'
import { tgsrtcBaseUrl, urls } from '../../api/config'
import { mapNearbyBus } from './mapBusRoutes'
import { mapRouteCheckout } from './mapCheckout'
import { mapVehicleEta } from './mapVehicleEta'

const NEARBY_DEFAULTS = {
  show_all: false,
  /** Default true: buses covering source that also reach destination. */
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
 *
 * Request signature is always the same (lat/lon + destination_* + flags).
 * Flags only change API filtering:
 * - default: source∩destination
 * - filter_by_destination=false: all buses covering source (any destination)
 * - show_all=true: full fleet (coords still sent, ignored by API)
 */
export async function fetchBusRouteOptions(
  trip,
  { signal, showAll, filterByDestination } = {},
) {
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

  const show_all = Boolean(showAll ?? trip?.showAll ?? NEARBY_DEFAULTS.show_all)
  const filter_by_destination = Boolean(
    filterByDestination ??
      trip?.filterByDestination ??
      NEARBY_DEFAULTS.filter_by_destination,
  )

  const payload = {
    ...NEARBY_DEFAULTS,
    show_all,
    filter_by_destination,
    lat: trip.fromLat,
    lon: trip.fromLon,
    destination_lat: trip.toLat,
    destination_lon: trip.toLon,
  }

  const data = await GetRequest(url, payload, { signal })
  const rows = Array.isArray(data) ? data : Array.isArray(data?.buses) ? data.buses : []
  return rows
    .map((item, index) =>
      mapNearbyBus(item, index, {
        showAll: show_all,
        filterByDestination: filter_by_destination,
      }),
    )
    .filter(Boolean)
}

/**
 * Live vehicle ETA + stop list for route detail.
 * GET /vehicles/{vehicleId}/eta?cust_lat&cust_lon&drop_stop_id&eta_provider=osrm
 *
 * `anyDest`: list had no destination_stop — alighting expands to route end after ETA.
 */
export async function fetchRouteDetail(
  { vehicleId, custLat, custLon, dropStopId, anyDest = false },
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
  return mapVehicleEta(data, { resolveDropToRouteEnd: Boolean(anyDest) })
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
      anyDest: Boolean(query.anyDest),
    },
    { signal },
  )
  return mapRouteCheckout(detail, query)
}
