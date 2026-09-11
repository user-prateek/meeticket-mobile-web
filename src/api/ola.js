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
 *   is_hotspot_zone?: boolean,
 *   is_hotpot_zone?: boolean,
 *   name?: string,
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
 *   payAtPickup: boolean,
 *   includeInOnlineTotal: boolean,
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

/**
 * ride_estimate[].category → cab | auto | bike.
 * Docs: auto + erick (e-rickshaw) = auto; bike = bike (not offered in UI yet);
 * everything else = cab/car.
 */
const OLA_CATEGORY_MODE = {
  auto: 'auto',
  erick: 'auto',
  erisk: 'auto', // common typo / alias
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

/** Categories we do not surface yet (bike; rental/outstation need other service_type). */
const OLA_HIDDEN_CATEGORIES = new Set(['bike', 'rental', 'outstation'])

const OLA_MODE_ICON = {
  auto: olaAuto,
  bike: olaBike,
  cab: olaGoAc,
}

export function isOlaLiveConfigured() {
  return Boolean(urls.olaProducts && olaAccessToken)
}

/** Docs: ride_estimate may be [] or {} when drop coords are omitted. */
export function asOlaEstimateList(rideEstimate) {
  if (Array.isArray(rideEstimate)) return rideEstimate
  return []
}

/**
 * Display fare from ride_estimate only: always amount_min – amount_max (never upfront exact).
 * Ola is cash / pay-at-pickup — fare is estimate only, not charged online.
 * Keep upfront.fare_id for future booking APIs.
 * @param {OlaRideEstimate | null | undefined} estimate
 */
export function selectOlaDisplayFare(estimate) {
  if (!estimate) {
    return {
      fareInr: null,
      fareMaxInr: null,
      fareDisplay: '',
      isUpfront: false,
      fareId: null,
      payAtPickup: true,
    }
  }

  const fareId = estimate.upfront?.fare_id || null

  const min = estimate.amount_min != null ? Number(estimate.amount_min) : null
  const max = estimate.amount_max != null ? Number(estimate.amount_max) : null
  const hasMin = min != null && Number.isFinite(min)
  const hasMax = max != null && Number.isFinite(max)

  if (hasMin && hasMax) {
    const low = Math.round(Math.min(min, max))
    const high = Math.round(Math.max(min, max))
    return {
      fareInr: low,
      fareMaxInr: high,
      fareDisplay: low === high ? formatFare(low) : `${formatFare(low)} – ${formatFare(high)}`,
      isUpfront: false,
      fareId,
      payAtPickup: true,
    }
  }

  if (hasMin) {
    const low = Math.round(min)
    return {
      fareInr: low,
      fareMaxInr: null,
      fareDisplay: formatFare(low),
      isUpfront: false,
      fareId,
      payAtPickup: true,
    }
  }

  if (hasMax) {
    const high = Math.round(max)
    return {
      fareInr: high,
      fareMaxInr: null,
      fareDisplay: formatFare(high),
      isUpfront: false,
      fareId,
      payAtPickup: true,
    }
  }

  // Share: fares[].cost range (still estimate / cash).
  const shareFares = Array.isArray(estimate.fares) ? estimate.fares : []
  if (shareFares.length) {
    const costs = shareFares
      .map((row) => Number(row?.cost))
      .filter((n) => Number.isFinite(n))
    if (costs.length) {
      const low = Math.round(Math.min(...costs))
      const high = Math.round(Math.max(...costs))
      return {
        fareInr: low,
        fareMaxInr: high !== low ? high : null,
        fareDisplay: high !== low ? `${formatFare(low)} – ${formatFare(high)}` : formatFare(low),
        isUpfront: false,
        fareId,
        payAtPickup: true,
      }
    }
  }

  return {
    fareInr: null,
    fareMaxInr: null,
    fareDisplay: '',
    isUpfront: false,
    fareId,
    payAtPickup: true,
  }
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

function buildOlaSubtitle({ estimate, peak, lean, available, needsHotspotPickup }) {
  if (!available) return 'Unavailable near pickup'
  const parts = []
  if (needsHotspotPickup) parts.push('Pick a hotspot point')
  const tripMin =
    estimate?.travel_time_in_minutes != null
      ? Number(estimate.travel_time_in_minutes)
      : estimate?.travel_time_min != null
        ? Number(estimate.travel_time_min)
        : null
  if (tripMin != null && Number.isFinite(tripMin)) {
    parts.push(`${Math.round(tripMin)} min trip`)
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
 * Hotspot responses often set eta=-1 while ride_estimate still has fares — treat those as available.
 * @param {OlaRideCategory} category
 * @param {OlaRideEstimate | null} estimate
 * @returns {OlaLastMileVehicle}
 */
export function mapOlaCategoryToVehicle(category, estimate = null) {
  const mode = olaCategoryToMode(category.id)
  const etaRaw = category.eta != null ? Number(category.eta) : null
  const fare = selectOlaDisplayFare(estimate)
  const hasFare = fare.fareInr != null && Number.isFinite(fare.fareInr)
  const etaOk = etaRaw != null && Number.isFinite(etaRaw) && etaRaw >= 0
  // Docs: eta === -1 alone meant “no cabs at pin”; with a fare estimate (esp. hotspot) still offer it.
  const available =
    etaOk || hasFare || category.ride_now_allowed === true || category.ride_now_allowed === 'true'
  const needsHotspotPickup = available && !etaOk && hasFare
  const { peak, lean } = readPeakLean(category)

  const estimateDistance =
    estimate?.distance != null ? Number(estimate.distance) : Number.NaN
  const categoryDistance = category.distance != null ? Number(category.distance) : Number.NaN

  const travelTimeMin = (() => {
    if (estimate?.travel_time_in_minutes != null) {
      return Math.round(Number(estimate.travel_time_in_minutes))
    }
    if (estimate?.travel_time_min != null) {
      return Math.round(Number(estimate.travel_time_min))
    }
    return null
  })()

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
    isUpfront: false,
    /** Cash to driver — never add to Paytm / order online total. */
    payAtPickup: true,
    includeInOnlineTotal: false,
    etaMin: etaOk ? Math.round(etaRaw) : null,
    available,
    unavailable: !available,
    needsHotspotPickup,
    subtitle: buildOlaSubtitle({ estimate, peak, lean, available, needsHotspotPickup }),
    peak,
    lean,
    faster: etaOk && etaRaw <= 2,
    distanceKm:
      Number.isFinite(estimateDistance) && estimateDistance >= 0
        ? estimateDistance
        : Number.isFinite(categoryDistance) && categoryDistance >= 0
          ? categoryDistance
          : null,
    travelTimeMin,
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
  // First estimate wins when API duplicates a category (e.g. two `suv` rows).
  const estimateByCategory = new Map()
  for (const item of estimates) {
    const key = String(item.category || '').toLowerCase()
    if (!key || estimateByCategory.has(key)) continue
    estimateByCategory.set(key, item)
  }

  const vehicles = categories
    .filter((category) => {
      const id = String(category?.id || '').toLowerCase()
      return id && !OLA_HIDDEN_CATEGORIES.has(id)
    })
    .map((category) => {
      const estimate = estimateByCategory.get(String(category.id || '').toLowerCase()) || null
      return mapOlaCategoryToVehicle(category, estimate)
    })
    // Only categories with a usable ride_estimate (amount_min/max or share fares).
    .filter((vehicle) => includeUnavailable || (vehicle.available && vehicle.rawEstimate))
    // Product offers cab + auto for now — never surface bike in lists.
    .filter((vehicle) => vehicle.mode !== 'bike')

  const hotspotZone = payload?.hotspot_zone || null
  const hotspotActive = Boolean(
    hotspotZone?.is_hotspot_zone ?? hotspotZone?.is_hotpot_zone,
  )

  return {
    categories,
    estimates,
    hotspotZone,
    hotspotActive,
    hotspotName: hotspotZone?.name || null,
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
    return 'Ola is not configured. Set VITE_OLA_ACCESS_TOKEN in .env and restart the dev server.'
  }
  if (code === 'invalid_partner_key') return 'Ola partner token is invalid. Check VITE_OLA_APP_TOKEN.'
  if (code === 'invalid_token' || code === 'UNAUTHORIZED' || code === 'HTTP_401') {
    return 'Ola access token is missing or expired. Refresh VITE_OLA_ACCESS_TOKEN.'
  }
  return fallback || 'Could not load Ola ride estimates.'
}

/**
 * TEMP: fixed Bangalore coords matching working curl — replace with live trip later.
 * curl …/v1/products?pickup_lat=12.9502&pickup_lng=77.6417&drop_lat=13.0950287&drop_lng=77.6496671
 */
const OLA_HARDCODED_COORDS = {
  pickupLat: 12.9502,
  pickupLng: 77.6417,
  dropLat: 13.0950287,
  dropLng: 77.6496671,
}

/**
 * Resolve pickup/drop for last-mile estimate (access: user → station).
 */
export function resolveOlaTripEndpoints({ journey, trip, serviceId = 'pickup' } = {}) {
  // TEMP hardcode — ignore journey/trip until dynamic wiring is ready.
  void journey
  void trip
  void serviceId
  return {
    pickupLat: OLA_HARDCODED_COORDS.pickupLat,
    pickupLng: OLA_HARDCODED_COORDS.pickupLng,
    dropLat: OLA_HARDCODED_COORDS.dropLat,
    dropLng: OLA_HARDCODED_COORDS.dropLng,
    hasPickup: true,
    hasDrop: true,
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

  // TEMP: force working-curl lat/lng regardless of caller.
  const pickupLat = OLA_HARDCODED_COORDS.pickupLat
  const pickupLng = OLA_HARDCODED_COORDS.pickupLng
  const dropLat = OLA_HARDCODED_COORDS.dropLat
  const dropLng = OLA_HARDCODED_COORDS.dropLng

  const bearer = String(params.accessToken || olaAccessToken || '').trim()
  if (!bearer) {
    throw createOlaError('OLA_TOKEN_MISSING', userFacingOlaMessage('OLA_TOKEN_MISSING'))
  }

  const query = buildOlaProductsQuery({
    ...params,
    pickupLat,
    pickupLng,
    dropLat,
    dropLng,
    serviceType: params.serviceType || 'p2p',
  })

  // Match working curl: accept + Authorization Bearer only.
  const headers = {
    accept: 'application/json',
    Authorization: `Bearer ${bearer}`,
  }
  // Optional legacy header — only if configured.
  if (olaAppToken) {
    headers['x-app-token'] = olaAppToken
  }

  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value != null && value !== '') search.set(key, String(value))
  }

  const url = `${urls.olaProducts.replace(/\?$/, '')}?${search}`
  console.info('[ola] products request (hardcoded lat/lng)', {
    url,
    hasBearer: true,
    hasAppToken: Boolean(olaAppToken),
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
