import olaGoAc from '../assets/vehicles/ola_go_ac.png'
import { haversineKm } from '../lib/geocode'
import { fetchDrivingEtaMinutes } from '../lib/drivingEta'
import {
  refexClientId,
  refexClientSecret,
  refexCorporateName,
  refexPartnerName,
  refexStartOffsetMinutes,
  refexVendorId,
  urls,
} from './config'

/** Fallback ride minutes when Google Directions is unavailable. */
const REFEX_END_FALLBACK_MINUTES = 50

/** Guide §5.4 — reusable extra_charges block for mock car_types. */
function refexMockExtraCharges(overrides = {}) {
  return {
    night_charges: {
      amount: 0,
      is_included_in_base_fare: false,
      is_included_in_grand_total: true,
      applicable_time_from: 0,
      applicable_time_till: 0,
    },
    airport_entry_fee: {
      amount: overrides.airportEntryFee ?? 0,
      cgst_on_airport_percent: 0,
      sgst_on_airport_percent: 0,
      is_included_in_base_fare: false,
      is_included_in_grand_total: true,
      is_applicable: Boolean(overrides.airportEntryFee),
    },
    airport_toll: {
      amount: 0,
      is_included_in_base_fare: false,
      is_included_in_grand_total: true,
      is_applicable: true,
    },
    toll_charges: {
      amount: overrides.tollCharges ?? 0,
      is_included_in_base_fare: false,
      is_included_in_grand_total: true,
    },
    state_tax: {
      amount: 0,
      is_included_in_base_fare: false,
      is_included_in_grand_total: true,
    },
    waiting_charges: {
      amount: 0,
      is_included_in_base_fare: false,
      is_included_in_grand_total: false,
      free_waiting_time: 0,
      applicable_time: 1,
    },
    convenience_charges: {
      amount: 0,
      is_included_in_base_fare: false,
      is_included_in_grand_total: true,
    },
    Gst: {
      amount: overrides.gst ?? 40,
      is_included_in_base_fare: false,
      is_included_in_grand_total: true,
    },
  }
}

/** One car_types[] entry — MeeTicket Integration API v1.0. */
function refexMockCarType({
  type,
  model,
  combustion_type,
  total_fare,
  base_fare,
  per_km_charge = 25,
  extraOverrides,
}) {
  return {
    sku_id: 'MeeTicket',
    type,
    subcategory: null,
    model,
    combustion_type,
    cancellation_rule: null,
    fare_details: {
      total_fare,
      base_fare,
      per_km_charge,
      per_km_extra_charge: per_km_charge,
      total_driver_charges: 0,
      cgst_on_ride_percent: 0,
      sgst_on_ride_percent: 0,
      extra_charges: refexMockExtraCharges(extraOverrides),
    },
    IncludedHr: null,
    AdditionalFarePerHr: null,
    passengers_allowed: String(type === 'suv' ? 6 : 4),
    luggagebags_allowed: type === 'suv' ? 3 : 2,
    ACAvailable: true,
    PackageInclusions: null,
    PackageExclusions: null,
    PackageExtras: null,
    CarInclusions: null,
    CarExclusions: null,
    CarExtras: null,
  }
}

/**
 * MeeTicket Integration API v1.0 — Search SUCCESS body (no wrapper envelope).
 * HTTP 200 returns car_types at the top level.
 */
export function buildRefexSearchMockResponse({ distance = '3.6', startTime } = {}) {
  const dist = Number(distance) || 3.6

  return {
    distance_booked: dist,
    is_instant_search: false,
    is_instant_available: true,
    is_part_payment_allowed: 'true',
    communication_type: null,
    verification_type: null,
    car_types: [
      refexMockCarType({
        type: 'sedan',
        model: 'Citroen EV or similar',
        combustion_type: 'electric',
        total_fare: 309,
        base_fare: 309,
        per_km_charge: 25,
      }),
      refexMockCarType({
        type: 'sedan',
        model: 'Nexon EV or similar',
        combustion_type: 'electric',
        total_fare: 349,
        base_fare: 349,
        per_km_charge: 25,
      }),
    ],
  }
}

/** Guide §3.1 — required on every Partner → Refex call. */
export function refexAuthHeaders() {
  return {
    'client-id': refexClientId,
    'client-secret': refexClientSecret,
  }
}

/**
 * Refex MeeTicket API uses HTTP status as the outcome (200 = cars, 404 = no availability).
 * Do not treat 404 as a transport/proxy failure.
 */
async function postMeeticketRefex(url, body, { signal } = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...refexAuthHeaders(),
    },
    body: JSON.stringify(body),
    signal,
  })

  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }

  if (response.status === 200 || response.status === 404) {
    return { status: response.status, data }
  }

  const message =
    (data && typeof data === 'object' && (data.error || data.errorMessage)) ||
    text?.slice(0, 200) ||
    `Refex request failed (HTTP ${response.status})`
  const err = new Error(String(message))
  err.status = response.status
  err.body = data
  throw err
}

/** Guide §2.1 — yyyy-MM-dd HH:mm:ss in IST (UTC+05:30). */
export function formatRefexDateTime(date = new Date()) {
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000)
  const y = ist.getUTCFullYear()
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0')
  const d = String(ist.getUTCDate()).padStart(2, '0')
  const hh = String(ist.getUTCHours()).padStart(2, '0')
  const mm = String(ist.getUTCMinutes()).padStart(2, '0')
  const ss = String(ist.getUTCSeconds()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`
}

/** Pickup must be in the future — default +30 minutes IST. */
export function defaultRefexStartTime(minutesAhead = 30) {
  return formatRefexDateTime(new Date(Date.now() + minutesAhead * 60 * 1000))
}

/** Latest pickup window — default start + 50 minutes (sample uses 50). */
export function defaultRefexEndTime(startTime, minutesAfterStart = 50) {
  if (!startTime) return defaultRefexStartTime(30 + minutesAfterStart)
  const match = String(startTime).match(
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/,
  )
  if (!match) return defaultRefexStartTime(30 + minutesAfterStart)
  const [, y, m, d, hh, mm, ss] = match.map(Number)
  const utcMs = Date.UTC(y, m - 1, d, hh, mm, ss) - 5.5 * 60 * 60 * 1000
  return formatRefexDateTime(new Date(utcMs + minutesAfterStart * 60 * 1000))
}

export function createRefexSearchId(prefix = 'MT') {
  const stamp = formatRefexDateTime().replace(/[-: ]/g, '')
  const rand = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0')
  return `${prefix}-SRCH-${stamp}-${rand}`
}

function upperCity(value, fallback = 'HYDERABAD') {
  const city = String(value || fallback).trim()
  return city ? city.toUpperCase() : fallback
}

/** Refex staging accepts short city-style strings (see working curl: "hyderabad"). */
function shortRefexAddress(label, fallback = 'hyderabad') {
  const text = String(label || '').trim()
  if (!text) return fallback
  return text.split(',')[0].trim() || fallback
}

function formatRefexDistanceKm(value, fallback = '1.0') {
  const km = Number(value)
  if (!Number.isFinite(km) || km <= 0) return fallback
  return km.toFixed(1)
}

function typeToMode(type = '') {
  const t = String(type).toLowerCase()
  if (t.includes('auto') || t.includes('rickshaw')) return 'auto'
  if (t.includes('bike') || t.includes('scooter')) return 'bike'
  return 'cab'
}

function carLabel(car) {
  if (car.model) return car.model
  const parts = [car.type, car.subcategory].filter(Boolean)
  return parts.length ? parts.join(' · ') : car.sku_id || 'Refex Cab'
}

function carSubtitle(car) {
  const parts = []
  if (car.type) parts.push(String(car.type).toUpperCase())
  if (car.ACAvailable) parts.push('AC')
  if (car.combustion_type) parts.push(car.combustion_type)
  if (car.passengers_allowed != null) parts.push(`${car.passengers_allowed} seats`)
  if (car.luggagebags_allowed != null) parts.push(`${car.luggagebags_allowed} bags`)
  return parts.join(' · ')
}

/**
 * Map one Refex car_types item → LastMile vehicle row.
 * Keep `raw` for Block Cab (must echo search values exactly).
 */
export function mapRefexCarType(car, index = 0, { searchId, distanceKm } = {}) {
  const fare = Number(car?.fare_details?.total_fare) || 0
  const baseFare = Number(car?.fare_details?.base_fare) || 0
  return {
    id: `refex_${car.type || 'car'}_${car.subcategory || index}_${car.combustion_type || 'x'}`,
    label: carLabel(car),
    mode: typeToMode(car.type),
    icon: olaGoAc,
    fareInr: fare,
    baseFareInr: baseFare,
    subtitle: carSubtitle(car),
    providerId: 'refex',
    searchId: searchId || null,
    distanceKm: distanceKm != null ? Number(distanceKm) : null,
    vehicleType: car.type,
    model: car.model,
    combustionType: car.combustion_type,
    skuId: car.sku_id,
    cancellationRule: car.cancellation_rule,
    passengersAllowed: car.passengers_allowed,
    luggageBagsAllowed: car.luggagebags_allowed,
    acAvailable: Boolean(car.ACAvailable),
    fareDetails: car.fare_details || null,
    raw: car,
  }
}

export function mapRefexSearchResponse(payload, { searchId, httpOk = true } = {}) {
  // MeeTicket API: success body is flat with car_types. Legacy envelope also supported.
  const isErrorShape =
    payload &&
    typeof payload === 'object' &&
    payload.response === null &&
    typeof payload.error === 'string'

  const isEmptyEnvelope =
    payload &&
    typeof payload === 'object' &&
    payload.response === null &&
    payload.error == null &&
    payload.code == null &&
    !Array.isArray(payload.car_types) &&
    !payload?.responseData?.car_types

  const data = Array.isArray(payload?.car_types)
    ? payload
    : payload?.responseData && Array.isArray(payload.responseData.car_types)
      ? payload.responseData
      : null

  const carTypes = Array.isArray(data?.car_types) ? data.car_types : []
  const distanceKm = data?.distance_booked != null ? Number(data.distance_booked) : null
  const vehicles = carTypes.map((car, index) =>
    mapRefexCarType(car, index, { searchId, distanceKm }),
  )
  const ok =
    httpOk &&
    !isErrorShape &&
    !isEmptyEnvelope &&
    (Number(payload?.errorCode) === 200 ||
      (payload?.errorCode == null && carTypes.length >= 0 && data != null))

  return {
    ok: Boolean(ok && !isErrorShape && !isEmptyEnvelope),
    errorCode: isErrorShape ? null : payload?.errorCode ?? null,
    errorMessage: isErrorShape
      ? payload.error
      : isEmptyEnvelope
        ? 'Refex search returned no availability for this trip'
        : payload?.errorMessage ?? null,
    searchId: searchId || null,
    distanceKm,
    startTime: data?.start_time ?? null,
    isInstantAvailable: Boolean(data?.is_instant_available),
    isInstantSearch: Boolean(data?.is_instant_search),
    communicationType: data?.communication_type ?? null,
    verificationType: data?.verification_type ?? null,
    vehicles,
    raw: payload,
  }
}

/**
 * Search request body — field names/casing match working Postman payload exactly:
 * PickUpPlaceId, PickUpAddress, PickUplat, PickUplon, DropPlaceId, DropAddress,
 * Droplat, Droplon, TripMode, StartTime, EndTime, Distance, SearchId, VendorId,
 * CorporateName, PickUpCity, DropCity, Epass_Status
 */
export function buildRefexSearchPayload({
  searchId,
  tripMode = 'POINT TO POINT',
  startTime,
  endTime,
  pickUplat,
  pickUplon,
  droplat,
  droplon,
  pickUpAddress = '',
  dropAddress = '',
  pickUpPlaceId = '1',
  dropPlaceId = '1',
  pickUpCity = 'HYDERABAD',
  dropCity = 'HYDERABAD',
  distance = '1.0',
  vendorId = refexVendorId,
  corporateName = refexCorporateName,
  epassStatus = '1',
} = {}) {
  const StartTime = startTime || defaultRefexStartTime()
  const EndTime = endTime || defaultRefexEndTime(StartTime)

  return {
    PickUpPlaceId: String(pickUpPlaceId ?? '1'),
    PickUpAddress: String(pickUpAddress ?? ''),
    PickUplat: Number(pickUplat),
    PickUplon: Number(pickUplon),
    DropPlaceId: String(dropPlaceId ?? '1'),
    DropAddress: String(dropAddress ?? ''),
    Droplat: Number(droplat),
    Droplon: Number(droplon),
    TripMode: String(tripMode || 'POINT TO POINT'),
    StartTime,
    EndTime,
    Distance: String(distance ?? '1.0'),
    SearchId: String(searchId),
    VendorId: String(vendorId ?? ''),
    CorporateName: String(corporateName || 'Mee Ticket'),
    PickUpCity: upperCity(pickUpCity),
    DropCity: upperCity(dropCity),
    Epass_Status: String(epassStatus ?? '1'),
  }
}

/** Pickup StartTime in IST (offset from env via config). */
export function refexPickupStartTime() {
  return defaultRefexStartTime(refexStartOffsetMinutes)
}

/**
 * EndTime = StartTime + driving minutes (Google Directions).
 * Falls back to access duration or 50 min if Directions fails.
 */
export async function resolveRefexEndTime({
  startTime,
  pickUplat,
  pickUplon,
  droplat,
  droplon,
  fallbackMinutes,
} = {}) {
  let driveMin = null
  const hasCoords = [pickUplat, pickUplon, droplat, droplon].every(
    (value) => value != null && Number.isFinite(Number(value)),
  )

  if (hasCoords) {
    try {
      driveMin = await fetchDrivingEtaMinutes({
        fromLat: pickUplat,
        fromLng: pickUplon,
        toLat: droplat,
        toLng: droplon,
      })
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[refex] Google driving ETA failed — using fallback', error)
      }
    }
  }

  const minutesAfterStart =
    driveMin > 0
      ? driveMin
      : Math.max(Number(fallbackMinutes) || 0, REFEX_END_FALLBACK_MINUTES)

  return {
    endTime: defaultRefexEndTime(startTime, minutesAfterStart),
    driveMin: driveMin > 0 ? driveMin : null,
    minutesAfterStart,
  }
}

/**
 * Resolve Refex search endpoints from journey + trip.
 * Pickup: user location → boarding station. Drop: alighting station → destination.
 */
function readCoord(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Pull lat/lng echoed on pg/status (order-level pickup/drop + optional CAB leg_info). */
export function coordsFromPgStatus(pgStatus) {
  if (!pgStatus || typeof pgStatus !== 'object') return null

  const bookings = Array.isArray(pgStatus.bookings) ? pgStatus.bookings : []
  const cab = bookings.find((leg) => String(leg?.leg_type || '').toUpperCase() === 'CAB')
  const info = cab?.leg_info && typeof cab.leg_info === 'object' ? cab.leg_info : {}
  const details =
    cab?.booking_details && typeof cab.booking_details === 'object' ? cab.booking_details : {}

  // Prefer order-level pickup/drop (A/B) from create-order / pg/status.
  const tripFromLat = readCoord(
    pgStatus.pickup_lat ?? pgStatus.from_lat ?? pgStatus.origin_lat ?? pgStatus.fromLat,
  )
  const tripFromLon = readCoord(
    pgStatus.pickup_lng ??
      pgStatus.pickup_lon ??
      pgStatus.from_lon ??
      pgStatus.from_lng ??
      pgStatus.origin_lon ??
      pgStatus.origin_lng ??
      pgStatus.fromLon,
  )
  const tripToLat = readCoord(
    pgStatus.drop_lat ??
      pgStatus.to_lat ??
      pgStatus.destination_lat ??
      pgStatus.dest_lat ??
      pgStatus.toLat,
  )
  const tripToLon = readCoord(
    pgStatus.drop_lng ??
      pgStatus.drop_lon ??
      pgStatus.to_lon ??
      pgStatus.to_lng ??
      pgStatus.destination_lon ??
      pgStatus.destination_lng ??
      pgStatus.dest_lng ??
      pgStatus.toLon,
  )

  return {
    tripFromLat,
    tripFromLon,
    tripToLat,
    tripToLon,
    pickupPlaceName: pgStatus.pickup_place_name || null,
    dropPlaceName: pgStatus.drop_place_name || null,
    // First-mile cab: pickup = user origin, drop = boarding station (not alighting).
    cabPickupLat: readCoord(info.pickup_lat ?? details.pickup_lat) ?? tripFromLat,
    cabPickupLng:
      readCoord(info.pickup_lng ?? details.pickup_lng ?? info.pickup_lon) ?? tripFromLon,
    cabDropLat: readCoord(info.drop_lat ?? details.drop_lat),
    cabDropLng: readCoord(info.drop_lng ?? details.drop_lng ?? info.drop_lon),
  }
}

export function resolveRefexTripEndpoints({
  journey,
  trip,
  serviceId = 'pickup',
  pgStatus,
} = {}) {
  const isDrop = serviceId === 'drop'
  const mile = isDrop ? journey?.egress : journey?.access
  const raw = isDrop ? journey?.raw?.egress : journey?.raw?.access
  const pgCoords = coordsFromPgStatus(pgStatus)

  const tripFromLat =
    readCoord(trip?.fromLat) ?? pgCoords?.tripFromLat ?? pgCoords?.cabPickupLat ?? null
  const tripFromLon =
    readCoord(trip?.fromLon ?? trip?.fromLng) ??
    pgCoords?.tripFromLon ??
    pgCoords?.cabPickupLng ??
    null
  const tripToLat =
    readCoord(trip?.toLat) ?? pgCoords?.tripToLat ?? null
  const tripToLon =
    readCoord(trip?.toLon ?? trip?.toLng) ?? pgCoords?.tripToLon ?? null

  // Drop pickup = alighting station (egress.from). Never use first-mile cab drop
  // (that is boarding). Destination = trip.to / pg destination.
  const pickUplat = isDrop
    ? readCoord(mile?.fromLat ?? raw?.from_lat)
    : readCoord(mile?.fromLat ?? raw?.from_lat) ?? tripFromLat
  const pickUplon = isDrop
    ? readCoord(mile?.fromLon ?? raw?.from_lon)
    : readCoord(mile?.fromLon ?? raw?.from_lon) ?? tripFromLon
  const droplat = isDrop
    ? readCoord(mile?.toLat ?? raw?.to_lat) ?? tripToLat
    : readCoord(mile?.toLat ?? raw?.to_lat)
  const droplon = isDrop
    ? readCoord(mile?.toLon ?? raw?.to_lon) ?? tripToLon
    : readCoord(mile?.toLon ?? raw?.to_lon)

  const pickUpAddress = String(
    isDrop
      ? mile?.fromLabel || journey?.destinationStation || ''
      : trip?.fromPlace ?? mile?.fromLabel ?? '',
  )
  const dropAddress = String(
    isDrop
      ? trip?.toPlace ?? mile?.toLabel ?? ''
      : mile?.toLabel ?? journey?.originStation ?? '',
  )

  const hasCoords = [pickUplat, pickUplon, droplat, droplon].every((value) => value != null)

  let distance = '1.0'
  if (mile?.distanceM) {
    distance = formatRefexDistanceKm(Number(mile.distanceM) / 1000)
  } else if (hasCoords) {
    distance = formatRefexDistanceKm(haversineKm(pickUplat, pickUplon, droplat, droplon))
  }

  return {
    pickUplat,
    pickUplon,
    droplat,
    droplon,
    pickUpAddress: shortRefexAddress(pickUpAddress),
    dropAddress: shortRefexAddress(dropAddress),
    pickUpPlaceId: '1',
    dropPlaceId: '1',
    pickUpCity: 'HYDERABAD',
    dropCity: 'HYDERABAD',
    distance,
    hasCoords,
    missing: {
      pickUp: pickUplat == null || pickUplon == null,
      drop: droplat == null || droplon == null,
    },
  }
}

export async function searchRefexForJourney(
  { journey, trip, serviceId = 'pickup', pgStatus } = {},
  { signal } = {},
) {
  const endpoints = resolveRefexTripEndpoints({ journey, trip, serviceId, pgStatus })
  const startTime = refexPickupStartTime()
  const searchId = createRefexSearchId('Refex')

  if (!endpoints.hasCoords) {
    const bits = []
    if (endpoints.missing?.pickUp) {
      bits.push(
        serviceId === 'drop'
          ? 'alighting station coords (journey egress)'
          : 'pickup coords',
      )
    }
    if (endpoints.missing?.drop) {
      bits.push(
        serviceId === 'drop'
          ? 'destination coords (trip / pg status)'
          : 'station drop coords',
      )
    }
    throw new Error(
      `Missing ${bits.join(' and ') || 'pickup or drop coordinates'} for Refex search`,
    )
  }

  const mile = serviceId === 'drop' ? journey?.egress : journey?.access
  const { endTime, driveMin, minutesAfterStart } = await resolveRefexEndTime({
    startTime,
    pickUplat: endpoints.pickUplat,
    pickUplon: endpoints.pickUplon,
    droplat: endpoints.droplat,
    droplon: endpoints.droplon,
    fallbackMinutes: mile?.durationMin,
  })

  console.info('[refex] journey search', {
    journeyId: journey?.id,
    serviceId,
    searchId,
    hasCoords: endpoints.hasCoords,
    startTime,
    endTime,
    driveMin,
    minutesAfterStart,
    distance: endpoints.distance,
    pickUplat: endpoints.pickUplat,
    pickUplon: endpoints.pickUplon,
    droplat: endpoints.droplat,
    droplon: endpoints.droplon,
    pickUpAddress: endpoints.pickUpAddress,
    dropAddress: endpoints.dropAddress,
  })

  return searchRefex(
    {
      ...endpoints,
      startTime,
      endTime,
      searchId,
    },
    { signal, useMock: false },
  )
}


/**
 * POST …/thirdparty/v1/api/meeticket/search
 * Uses mock when VITE_REFEX_BASE_URL is not set, or live fails/empty in DEV.
 */
export async function searchRefex(params = {}, { signal, useMock } = {}) {
  const searchId = params.searchId || createRefexSearchId()
  const startTime = params.startTime || defaultRefexStartTime()
  const endTime = params.endTime || defaultRefexEndTime(startTime)
  const shouldMock = useMock ?? !urls.refexSearch

  const mockFromRequest = () =>
    buildRefexSearchMockResponse({
      distance: params.distance ?? '1.0',
      startTime,
    })

  if (shouldMock) {
    const mapped = mapRefexSearchResponse(mockFromRequest(), { searchId })
    return { ...mapped, searchId, startTime, endTime, mock: true }
  }

  if (!refexClientId || !refexClientSecret) {
    throw new Error('Refex client-id / client-secret missing (VITE_REFEX_CLIENT_ID / VITE_REFEX_CLIENT_SECRET)')
  }

  const body = buildRefexSearchPayload({ ...params, searchId, startTime, endTime })
  console.info('[refex] search request', { url: urls.refexSearch, body })

  let payload
  let httpStatus = 200
  try {
    const response = await postMeeticketRefex(urls.refexSearch, body, { signal })
    payload = response.data
    httpStatus = response.status
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[refex] search request failed — using mock response', error)
      const mapped = mapRefexSearchResponse(mockFromRequest(), { searchId })
      return {
        ...mapped,
        searchId,
        startTime,
        endTime,
        mock: true,
        mockReason: 'network_error',
        liveErrorMessage: error.message,
      }
    }
    throw error
  }

  const mapped = mapRefexSearchResponse(payload, { searchId, httpOk: httpStatus === 200 })
  const noCars = mapped.ok && mapped.vehicles.length === 0

  if (import.meta.env.DEV && (!mapped.ok || noCars)) {
    console.warn('[refex] live search unavailable', {
      httpStatus,
      errorMessage: mapped.errorMessage,
      carCount: mapped.vehicles.length,
      raw: payload,
    })
    const mockMapped = mapRefexSearchResponse(mockFromRequest(), { searchId })
    return {
      ...mockMapped,
      searchId,
      startTime,
      endTime,
      mock: true,
      mockReason:
        httpStatus === 404 ? 'no_availability' : !mapped.ok ? 'api_error' : 'empty_car_types',
      liveErrorMessage: mapped.errorMessage,
      liveHttpStatus: httpStatus,
    }
  }

  if (!mapped.ok) {
    const suffix =
      httpStatus === 404
        ? ' (Refex HTTP 404 — no cabs for this route on staging, not a proxy URL error)'
        : ''
    throw new Error((mapped.errorMessage || 'Refex search failed') + suffix)
  }

  if (mapped.vehicles.length === 0) {
    throw new Error('Refex search returned no vehicles')
  }

  return { ...mapped, searchId, startTime, endTime, mock: false }
}

/**
 * MeeTicket Integration API — Payment confirmation.
 */
export function buildRefexPaymentPayload({
  bookingReferenceNumber,
  orderReferenceNo,
  passengerName,
  passengerEmail,
  passengerPhone,
  passengerCountryCode = '+91',
  totalFare,
  amountToBeCollected = 0,
  vendorId = refexVendorId,
  partnerName = refexPartnerName,
} = {}) {
  return {
    passengername: passengerName,
    passengeremail: passengerEmail,
    passengerphone_number: passengerPhone,
    passengercountry_code: passengerCountryCode,
    BookingReferenceNumber: bookingReferenceNumber,
    OrderReferenceNo: orderReferenceNo,
    Total_fare: Number(totalFare) || 0,
    amount_to_be_collected: Number(amountToBeCollected) || 0,
    vendor_id: Number(vendorId) || vendorId,
    partner_name: partnerName || 'Mee Ticket',
  }
}

export async function confirmRefexPayment(params, { signal, useMock } = {}) {
  const shouldMock = useMock ?? !urls.refexPayment
  const body = buildRefexPaymentPayload(params)

  if (shouldMock) {
    return {
      ok: true,
      jobNo: 'C-CPTOP206781334',
      vehicleRegistrationNumber: null,
      raw: {
        response: {
          success: true,
          job_no: 'C-CPTOP206781334',
          vehicle_registration_number: null,
        },
        error: null,
        code: null,
      },
    }
  }

  const { status, data: payload } = await postMeeticketRefex(urls.refexPayment, body, { signal })

  const response = payload?.response
  if (status !== 200 || !response?.success || !response?.job_no) {
    throw new Error(payload?.error || 'Refex payment failed')
  }

  return {
    ok: true,
    jobNo: response.job_no,
    vehicleRegistrationNumber: response.vehicle_registration_number ?? null,
    raw: payload,
  }
}
