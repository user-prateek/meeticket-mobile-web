import { LAST_MILE_OPTIONS, LAST_MILE_PROVIDERS } from '../constants/journey'
import { tripToCabSearch, tripToCabSearchParams } from './tripQuery'

/** Synthetic journey id for door-to-door cab (no metro / bus option). */
export const CAB_DIRECT_JOURNEY_ID = 'direct'

export function isCabDirectJourney(journey) {
  return Boolean(journey?.cabDirect) || String(journey?.id) === CAB_DIRECT_JOURNEY_ID
}

export function isCabDirectRequest(params, lastMile, journey) {
  if (lastMile?.cabDirect || isCabDirectJourney(journey)) return true
  if (!params) return false
  return params.get('direct') === '1' || params.get('id') === CAB_DIRECT_JOURNEY_ID
}

/**
 * Door-to-door cab: access = A → B (same geometry as first-mile, drop is destination).
 * Empty `segments` so `buildOrderPayload` emits a CAB-only order.
 */
export function buildDirectCabJourney(trip) {
  if (!trip) return null
  const fromLat = trip.fromLat
  const fromLon = trip.fromLon ?? trip.fromLng
  const toLat = trip.toLat
  const toLon = trip.toLon ?? trip.toLng
  if ([fromLat, fromLon, toLat, toLon].some((value) => value == null)) return null

  const fromLabel = trip.fromPlace || 'Pickup'
  const toLabel = trip.toPlace || 'Drop'
  const access = {
    fromLat,
    fromLon,
    fromLabel,
    toLat,
    toLon,
    toLabel,
  }

  return {
    id: CAB_DIRECT_JOURNEY_ID,
    cabDirect: true,
    segments: [],
    stops: [],
    access,
    egress: {
      fromLat: toLat,
      fromLon: toLon,
      fromLabel: toLabel,
      toLat,
      toLon,
      toLabel,
    },
    originStation: toLabel,
    destinationStation: toLabel,
    lastMileProviders: LAST_MILE_PROVIDERS,
    lastMileOptions: LAST_MILE_OPTIONS,
    totalFareInr: 0,
  }
}

export function rideHomePath(trip) {
  const q = tripToCabSearch(trip)
  return q ? `/ride${q}` : '/ride'
}

export function cabDirectPath({ trip, providerId, modeId, vehicleId } = {}) {
  const params = tripToCabSearchParams(trip)
  params.set('direct', '1')
  params.set('id', CAB_DIRECT_JOURNEY_ID)
  params.set('service', 'pickup')
  if (providerId) params.set('provider', providerId)
  if (modeId) params.set('mode', modeId)
  if (vehicleId) params.set('vehicle', vehicleId)
  return `/cab?${params.toString()}`
}

export function cabDirectPaymentPath() {
  return `/payment?id=${CAB_DIRECT_JOURNEY_ID}&direct=1`
}
