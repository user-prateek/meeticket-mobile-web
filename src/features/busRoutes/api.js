import { GetRequest } from '../../api/client'
import { tgsrtcBaseUrl, urls } from '../../api/config'
import { mapNearbyBus } from './mapBusRoutes'
import { mapRouteCheckout } from './mapCheckout'
import { mapVehicleEta } from './mapVehicleEta'

const NEARBY_DEFAULTS = {
  /** Debug-only: true = every active vehicle; ignores coords. */
  show_all: false,
  filter_by_destination: true,
  radius_km: 5,
  walk_km: 1,
  destination_radius_km: 1,
  max_boarding_stops: 3,
  max_destination_stops: 3,
  eta_provider: 'osrm',
}

/** Wider search when browsing by destination only (ignore rider source). */
const DEST_ONLY_DEFAULTS = {
  radius_km: 50,
  walk_km: 5,
  destination_radius_km: 2,
  max_boarding_stops: 10,
  max_destination_stops: 10,
}

/**
 * Live TGSRTC nearby-buses → list cards + map pins.
 *
 * Modes:
 * - show_all=true → full active fleet (debug)
 * - destination-only → to_lat/to_lon + filter_by_destination, no source (source ignored)
 * - production A→B → from + to, filter trips that reach destination near rider
 * - source-only → from_lat/from_lon with filter_by_destination=false
 */
export async function fetchBusRouteOptions(
  trip,
  { signal, showAll, filterByDestination } = {},
) {
  const url = urls.nearbyBuses
  if (!url) throw new Error('TGSRTC API is not configured')

  const show_all = Boolean(showAll ?? trip?.showAll ?? NEARBY_DEFAULTS.show_all)
  const filter_by_destination = Boolean(
    filterByDestination ??
      trip?.filterByDestination ??
      NEARBY_DEFAULTS.filter_by_destination,
  )
  const hasSource = trip?.fromLat != null && trip?.fromLon != null
  const hasDest = trip?.toLat != null && trip?.toLon != null

  if (show_all) {
    const payload = {
      show_all: true,
      filter_by_destination,
      eta_provider: NEARBY_DEFAULTS.eta_provider,
      ...(filter_by_destination && hasDest
        ? {
            destination_lat: trip.toLat,
            destination_lon: trip.toLon,
          }
        : {}),
    }
    const data = await GetRequest(url, payload, { signal })
    const rows = Array.isArray(data) ? data : Array.isArray(data?.buses) ? data.buses : []
    return rows
      .map((item, index) => mapNearbyBus(item, index, { showAll: true }))
      .filter(Boolean)
  }

  // Destination-only browse: ignore source, list buses going to that destination.
  if (filter_by_destination && hasDest && !hasSource) {
    const payload = {
      ...NEARBY_DEFAULTS,
      ...DEST_ONLY_DEFAULTS,
      show_all: false,
      filter_by_destination: true,
      // API requires lat/lon — center search on destination.
      lat: trip.toLat,
      lon: trip.toLon,
      destination_lat: trip.toLat,
      destination_lon: trip.toLon,
    }
    const data = await GetRequest(url, payload, { signal })
    const rows = Array.isArray(data) ? data : Array.isArray(data?.buses) ? data.buses : []
    return rows.map((item, index) => mapNearbyBus(item, index)).filter(Boolean)
  }

  if (filter_by_destination) {
    if (!hasSource || !hasDest) {
      throw new Error('from_lat, from_lon, to_lat and to_lon are required')
    }
    const payload = {
      ...NEARBY_DEFAULTS,
      show_all: false,
      filter_by_destination: true,
      lat: trip.fromLat,
      lon: trip.fromLon,
      destination_lat: trip.toLat,
      destination_lon: trip.toLon,
    }
    const data = await GetRequest(url, payload, { signal })
    const rows = Array.isArray(data) ? data : Array.isArray(data?.buses) ? data.buses : []
    return rows.map((item, index) => mapNearbyBus(item, index)).filter(Boolean)
  }

  if (!hasSource) {
    throw new Error('from_lat and from_lon are required')
  }
  const payload = {
    ...NEARBY_DEFAULTS,
    show_all: false,
    filter_by_destination: false,
    lat: trip.fromLat,
    lon: trip.fromLon,
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
