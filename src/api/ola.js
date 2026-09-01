import olaAuto from '../assets/vehicles/ola_auto.png'
import olaBike from '../assets/vehicles/ola_bike.png'
import olaGoAc from '../assets/vehicles/ola_go_ac.png'
import { formatFare } from '../constants/lastMile'
import { olaAccessToken, olaAppToken, urls } from './config'

/**
 * Ola GET /v1/products — types match Ride Availability/Estimate docs.
 *
 * @typedef {{
 *   pickupLat: number,
 *   pickupLng: number,
 *   dropLat?: number | null,
 *   dropLng?: number | null,
 *   category?: string | null,
 *   serviceType?: 'p2p' | 'rental' | 'outstation',
 *   pickupMode?: 'now' | 'later',
 *   accessToken?: string | null,
 * }} OlaRideEstimateParams
 *
 * @typedef {{
 *   lat: number,
 *   lng: number,
 *   id: string,
 *   bearing?: number,
 *   accuracy?: number,
 * }} OlaCabLocation
 *
 * @typedef {{
 *   category: string,
 *   distance?: number,
 *   travel_time_in_minutes?: number,
 *   amount_min?: number,
 *   amount_max?: number,
 *   booking_fee?: number,
 *   booking_fee_breakup?: Array<{ display_text?: string, value?: number }>,
 *   taxes?: { total_tax?: number },
 *   hub_charges?: {
 *     total_hub_fee?: number,
 *     pickup_hub_fee?: number,
 *     pickup_hub_name?: string,
 *   },
 *   discounts?: {
 *     discount_type?: string,
 *     discount_code?: string,
 *     discount_mode?: string,
 *     discount?: number,
 *     cashback?: number,
 *     pass_savings?: number,
 *   },
 *   upfront?: {
 *     fare?: number,
 *     fare_id?: string,
 *     select_discount?: unknown,
 *     is_upfront_applicable?: boolean,
 *   },
 * }} OlaRideEstimate
 *
 * @typedef {{
 *   id: string,
 *   display_name?: string,
 *   currency?: string,
 *   distance_unit?: string,
 *   time_unit?: string,
 *   eta?: number,
 *   distance?: string,
 *   ride_later_enabled?: string | boolean,
 *   image?: string,
 *   hotspot_pickup_points?: number[],
 *   cancellation_policy?: {
 *     cancellation_charge?: number,
 *     currency?: string,
 *     cancellation_charge_applies_after_time?: number,
 *     time_unit?: string,
 *   },
 *   fare_breakup?: Array<{
 *     type?: string,
 *     base_fare?: number,
 *     minimum_fare?: number,
 *     cost_per_distance?: number,
 *     ride_cost_per_minute?: number,
 *     surcharge?: unknown[],
 *     rates_lower_than_usual?: boolean,
 *     rates_higher_than_usual?: boolean,
 *   }>,
 *   all_cabs?: OlaCabLocation[],
 * }} OlaRideCategory
 *
 * @typedef {{
 *   is_hotpot_zone?: boolean,
 *   desc?: string,
 *   default_pickup_point_id?: number,
 *   hotspot_boundary?: number[][],
 *   pickup_points?: Array<{ lat: number, lng: number, name?: string, id: number }>,
 * }} OlaHotspotZone
 *
 * Normalized vehicle consumed by RouteCard / JourneyDetail / LastMilePage:
 * @typedef {{
 *   id: string,
 *   label: string,
 *   mode: 'cab' | 'auto' | 'bike',
 *   icon: string,
 *   fareInr: number | null,
 *   fareMaxInr: number | null,
 *   fareDisplay: string,
 *   fareId: string | null,
 *   isUpfront: boolean,
 *   etaMin: number | null,
 *   available: boolean,
 *   unavailable: boolean,
 *   subtitle?: string,
 *   peak: boolean,
 *   lean: boolean,
 *   distanceKm: number | null,
 *   travelTimeMin: number | null,
 *   providerId: 'ola',
 *   categoryId: string,
 *   currency: string,
 *   image: string | null,
 *   discountCode: string | null,
 *   bookingFee: number | null,
 *   hotspotPickupPoints: number[],
 *   nearbyCabs: OlaCabLocation[],
 *   rawCategory: OlaRideCategory,
 *   rawEstimate: OlaRideEstimate | null,
 * }} OlaLastMileVehicle
 */

const OLA_CATEGORY_MODE = {
  auto: 'auto',
  erick: 'auto',
  bike: 'bike',
  micro: 'cab',
  mini: 'cab',
  share: 'cab',
  prime: 'cab',
  suv: 'cab',
  prime_play: 'cab',
  lux: 'cab',
  sedan: 'cab',
  exec: 'cab',
  kp: 'cab',
  electric_vehicle: 'cab',
  cool_cab: 'cab',
  rental: 'cab',
  outstation: 'cab',
}

const OLA_MODE_ICON = {
  auto: olaAuto,
  bike: olaBike,
  cab: olaGoAc,
}

export function isOlaLiveConfigured() {
  return Boolean(urls.olaProducts && olaAppToken)
}

/** Docs: ride_estimate may be [] or {} when drop coords are omitted. */
export function asOlaEstimateList(rideEstimate) {
  if (Array.isArray(rideEstimate)) return rideEstimate
  return []
}

/**
 * Prefer upfront.fare when is_upfront_applicable; else amount_min – amount_max.
 * @param {OlaRideEstimate | null | undefined} estimate
 */
export function selectOlaDisplayFare(estimate) {
  if (!estimate) {
    return { fareInr: null, fareMaxInr: null, fareDisplay: '', isUpfront: false, fareId: null }
  }

  const upfront = estimate.upfront
  if (upfront?.is_upfront_applicable && upfront.fare != null && Number.isFinite(Number(upfront.fare))) {
    const fare = Number(upfront.fare)
    return {
      fareInr: fare,
      fareMaxInr: null,
      fareDisplay: formatFare(fare),
      isUpfront: true,
      fareId: upfront.fare_id || null,
    }
  }

  const min = estimate.amount_min != null ? Number(estimate.amount_min) : null
  const max = estimate.amount_max != null ? Number(estimate.amount_max) : null
  const hasMin = min != null && Number.isFinite(min)
  const hasMax = max != null && Number.isFinite(max)

  if (hasMin && hasMax && min !== max) {
    return {
      fareInr: min,
      fareMaxInr: max,
      fareDisplay: `${formatFare(min)} – ${formatFare(max)}`,
      isUpfront: false,
      fareId: null,
    }
  }

  if (hasMin) {
    return {
      fareInr: min,
      fareMaxInr: hasMax ? max : null,
      fareDisplay: formatFare(min),
      isUpfront: false,
      fareId: null,
    }
  }

  if (hasMax) {
    return {
      fareInr: max,
      fareMaxInr: null,
      fareDisplay: formatFare(max),
      isUpfront: false,
      fareId: null,
    }
  }

  return { fareInr: null, fareMaxInr: null, fareDisplay: '', isUpfront: false, fareId: null }
}

export function olaCategoryToMode(categoryId) {
  const key = String(categoryId || '').toLowerCase()
  return OLA_CATEGORY_MODE[key] || 'cab'
}

function readPeakLean(category) {
  const breakup = Array.isArray(category?.fare_breakup) ? category.fare_breakup : []
  const first = breakup[0] || {}
  return {
    peak: Boolean(first.rates_higher_than_usual),
    lean: Boolean(first.rates_lower_than_usual),
  }
}

function buildOlaSubtitle({ estimate, peak, lean, available }) {
  if (!available) return 'Unavailable near pickup'
  const parts = []
  if (estimate?.travel_time_in_minutes != null) {
    parts.push(`${Math.round(Number(estimate.travel_time_in_minutes))} min trip`)
  }
  if (peak) parts.push('Peak pricing')
  else if (lean) parts.push('Lower than usual')
  if (estimate?.discounts?.discount_code) {
    parts.push(String(estimate.discounts.discount_code))
  }
  return parts.join(' · ') || undefined
}

/**
 * Map one Ola category (+ matching ride_estimate) → last-mile vehicle row.
 * @param {OlaRideCategory} category
 * @param {OlaRideEstimate | null} estimate
 * @returns {OlaLastMileVehicle}
 */
export function mapOlaCategoryToVehicle(category, estimate = null) {
  const mode = olaCategoryToMode(category.id)
  const etaRaw = category.eta != null ? Number(category.eta) : null
  // Docs: eta === -1 → category not available near pickup.
  const available = etaRaw == null || etaRaw !== -1
  const fare = selectOlaDisplayFare(estimate)
  const { peak, lean } = readPeakLean(category)

  return {
    id: `ola_${category.id}`,
    label: category.display_name || category.id,
    mode,
    // Prefer local assets — Ola CDN images are often http and mixed-content blocked.
    icon: OLA_MODE_ICON[mode] || olaGoAc,
    fareInr: fare.fareInr,
    fareMaxInr: fare.fareMaxInr,
    fareDisplay: fare.fareDisplay,
    fareId: fare.fareId,
    isUpfront: fare.isUpfront,
    etaMin: available && etaRaw != null && etaRaw >= 0 ? Math.round(etaRaw) : null,
    available,
    unavailable: !available,
    subtitle: buildOlaSubtitle({ estimate, peak, lean, available }),
    peak,
    lean,
    faster: available && etaRaw != null && etaRaw >= 0 && etaRaw <= 2,
    distanceKm:
      estimate?.distance != null
        ? Number(estimate.distance)
        : category.distance != null
          ? Number(category.distance)
          : null,
    travelTimeMin:
      estimate?.travel_time_in_minutes != null
        ? Math.round(Number(estimate.travel_time_in_minutes))
        : null,
    providerId: 'ola',
    categoryId: category.id,
    currency: category.currency || 'INR',
    image: category.image || null,
    discountCode: estimate?.discounts?.discount_code || null,
    bookingFee: estimate?.booking_fee != null ? Number(estimate.booking_fee) : null,
    hotspotPickupPoints: Array.isArray(category.hotspot_pickup_points)
      ? category.hotspot_pickup_points
      : [],
    nearbyCabs: Array.isArray(category.all_cabs) ? category.all_cabs : [],
    rawCategory: category,
    rawEstimate: estimate,
  }
}

/**
 * @param {OlaCabLocation[]} cabs
 */
export function mapOlaCabsToMarkers(cabs = []) {
  return (Array.isArray(cabs) ? cabs : [])
    .map((cab) => {
      const lat = Number(cab.lat)
      const lng = Number(cab.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
      return {
        id: cab.id || `${lat},${lng}`,
        lat,
        lng,
        bearing: cab.bearing != null ? Number(cab.bearing) : null,
        accuracy: cab.accuracy != null ? Number(cab.accuracy) : null,
      }
    })
    .filter(Boolean)
}

/**
 * Normalize Ola /v1/products JSON → UI model.
 * @param {object} payload
 * @param {{ includeUnavailable?: boolean }} [options]
 */
export function normalizeOlaProductsResponse(payload, { includeUnavailable = false } = {}) {
  const categories = Array.isArray(payload?.categories) ? payload.categories : []
  const estimates = asOlaEstimateList(payload?.ride_estimate)
  const estimateByCategory = new Map(
    estimates.map((item) => [String(item.category || '').toLowerCase(), item]),
  )

  const vehicles = categories
    .map((category) => {
      const estimate = estimateByCategory.get(String(category.id || '').toLowerCase()) || null
      return mapOlaCategoryToVehicle(category, estimate)
    })
    .filter((vehicle) => includeUnavailable || vehicle.available)

  const hotspotZone = payload?.hotspot_zone || null
  const hotspotActive = Boolean(hotspotZone?.is_hotpot_zone)

  return {
    categories,
    estimates,
    hotspotZone,
    hotspotActive,
    hotspotDesc: hotspotZone?.desc || null,
    defaultPickupPointId: hotspotZone?.default_pickup_point_id ?? null,
    hotspotPickupPoints: Array.isArray(hotspotZone?.pickup_points) ? hotspotZone.pickup_points : [],
    vehicles,
    previousCancellationCharges: Array.isArray(payload?.previous_cancellation_charges)
      ? payload.previous_cancellation_charges
      : [],
    raw: payload,
  }
}

/**
 * @param {OlaRideEstimateParams} params
 */
export function buildOlaProductsQuery(params) {
  const {
    pickupLat,
    pickupLng,
    dropLat,
    dropLng,
    category,
    serviceType = 'p2p',
    pickupMode,
  } = params

  const query = {
    pickup_lat: pickupLat,
    pickup_lng: pickupLng,
    service_type: serviceType || 'p2p',
  }

  if (category) query.category = category
  if (pickupMode) query.pickup_mode = pickupMode
  if (dropLat != null && dropLat !== '' && Number.isFinite(Number(dropLat))) {
    query.drop_lat = Number(dropLat)
  }
  if (dropLng != null && dropLng !== '' && Number.isFinite(Number(dropLng))) {
    query.drop_lng = Number(dropLng)
  }

  return query
}

function createOlaError(code, message, status) {
  const err = new Error(message || 'Ola request failed')
  err.code = code || 'OLA_ERROR'
  err.status = status
  err.name = 'OlaApiError'
  return err
}

function userFacingOlaMessage(code, fallback) {
  if (code === 'INVALID_CITY') return 'Ola is not available in this city.'
  if (code === 'INVALID_CITY_CAR_CATEGORY') return 'This Ola category is not available here.'
  if (code === 'OLA_TOKEN_MISSING') {
    return 'Ola is not configured. Set VITE_OLA_APP_TOKEN in .env and restart the dev server.'
  }
  if (code === 'invalid_partner_key') return 'Ola partner token is invalid. Check VITE_OLA_APP_TOKEN.'
  return fallback || 'Could not load Ola ride estimates.'
}

/**
 * Resolve pickup/drop for last-mile estimate (access: user → station).
 */
export function resolveOlaTripEndpoints({ journey, trip, serviceId = 'pickup' } = {}) {
  const isDrop = serviceId === 'drop'
  const mile = isDrop ? journey?.egress : journey?.access

  const pickupLat = Number(isDrop ? mile?.fromLat : trip?.fromLat ?? mile?.fromLat)
  const pickupLng = Number(isDrop ? mile?.fromLon : trip?.fromLon ?? mile?.fromLon)
  const dropLat = Number(isDrop ? trip?.toLat ?? mile?.toLat : mile?.toLat)
  const dropLng = Number(isDrop ? trip?.toLon ?? mile?.toLon : mile?.toLon)

  const hasPickup = Number.isFinite(pickupLat) && Number.isFinite(pickupLng)
  const hasDrop = Number.isFinite(dropLat) && Number.isFinite(dropLng)

  return {
    pickupLat: hasPickup ? pickupLat : null,
    pickupLng: hasPickup ? pickupLng : null,
    dropLat: hasDrop ? dropLat : null,
    dropLng: hasDrop ? dropLng : null,
    hasPickup,
    hasDrop,
  }
}

/**
 * GET /v1/products — ride availability + estimate.
 * @param {OlaRideEstimateParams} params
 */
export async function getRideEstimate(params, { signal } = {}) {
  if (!urls.olaProducts) {
    throw createOlaError('OLA_NOT_CONFIGURED', 'Ola API URL is not configured')
  }
  if (!olaAppToken) {
    throw createOlaError('OLA_TOKEN_MISSING', userFacingOlaMessage('OLA_TOKEN_MISSING'))
  }

  const pickupLat = Number(params.pickupLat)
  const pickupLng = Number(params.pickupLng)
  if (!Number.isFinite(pickupLat) || !Number.isFinite(pickupLng)) {
    throw createOlaError('INVALID_PICKUP', 'Pickup latitude and longitude are required')
  }

  const query = buildOlaProductsQuery({
    ...params,
    pickupLat,
    pickupLng,
  })

  const headers = {
    Accept: 'application/json',
    'X-APP-TOKEN': olaAppToken,
    'x-app-token': olaAppToken,
  }

  const bearer = params.accessToken || olaAccessToken
  if (bearer) {
    headers.Authorization = `Bearer ${bearer}`
  }

  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value != null && value !== '') search.set(key, String(value))
  }

  const url = `${urls.olaProducts.replace(/\?$/, '')}?${search}`
  console.info('[ola] products request', {
    url,
    pickup_lat: query.pickup_lat,
    pickup_lng: query.pickup_lng,
    drop_lat: query.drop_lat,
    drop_lng: query.drop_lng,
    service_type: query.service_type,
  })

  const response = await fetch(url, {
    method: 'GET',
    headers,
    signal,
  })

  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }

  if (!response.ok) {
    const code = data?.code || `HTTP_${response.status}`
    const message = userFacingOlaMessage(code, data?.message)
    const err = createOlaError(code, message, response.status)
    err.body = data
    throw err
  }

  // Some Ola errors arrive as 200 with code/message only.
  if (data?.code && !data?.categories && !Array.isArray(data?.ride_estimate)) {
    const err = createOlaError(
      data.code,
      userFacingOlaMessage(data.code, data.message),
      response.status,
    )
    err.body = data
    throw err
  }

  const normalized = normalizeOlaProductsResponse(data)
  return {
    ok: true,
    mock: false,
    ...normalized,
    query,
  }
}

/**
 * Journey-aware estimate using access/egress coords.
 */
export async function getOlaRideEstimateForJourney(
  { journey, trip, serviceId = 'pickup', category, pickupMode } = {},
  { signal, accessToken } = {},
) {
  const endpoints = resolveOlaTripEndpoints({ journey, trip, serviceId })
  if (!endpoints.hasPickup) {
    throw createOlaError('INVALID_PICKUP', 'Pickup location is missing for this trip')
  }

  return getRideEstimate(
    {
      pickupLat: endpoints.pickupLat,
      pickupLng: endpoints.pickupLng,
      dropLat: endpoints.dropLat,
      dropLng: endpoints.dropLng,
      category,
      serviceType: 'p2p',
      pickupMode,
      accessToken,
    },
    { signal },
  )
}

const olaEstimateCache = new Map()
const olaEstimateInflight = new Map()

function olaCacheKey({ journey, trip, serviceId = 'pickup', category }) {
  const endpoints = resolveOlaTripEndpoints({ journey, trip, serviceId })
  return [
    serviceId,
    endpoints.pickupLat,
    endpoints.pickupLng,
    endpoints.dropLat,
    endpoints.dropLng,
    category || '',
  ].join('|')
}

/** In-session cache + inflight dedupe. Caller `signal` only ignores stale UI updates. */
export function getOlaRideEstimateForJourneyCached(
  { journey, trip, serviceId = 'pickup', category, signal, refresh = false } = {},
) {
  const key = olaCacheKey({ journey, trip, serviceId, category })

  let request
  if (!refresh && olaEstimateCache.has(key)) {
    request = Promise.resolve(olaEstimateCache.get(key))
  } else if (!refresh && olaEstimateInflight.has(key)) {
    request = olaEstimateInflight.get(key)
  } else {
    request = getOlaRideEstimateForJourney({ journey, trip, serviceId, category }, {})
      .then((result) => {
        olaEstimateCache.set(key, result)
        return result
      })
      .finally(() => {
        olaEstimateInflight.delete(key)
      })
    olaEstimateInflight.set(key, request)
  }

  return request.then((result) => {
    if (signal?.aborted) {
      const err = new Error('Aborted')
      err.name = 'AbortError'
      throw err
    }
    return result
  })
}
