import olaGoAc from '../assets/vehicles/ola_go_ac.png'
import { PostRequest } from './client'
import {
  refexClientId,
  refexClientSecret,
  refexCorporateName,
  refexPartnerName,
  refexVendorId,
  urls,
} from './config'

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

/** Static sample — prefer buildRefexSearchMockResponse() for request-aware mocks. */
export const REFEX_SEARCH_MOCK = buildRefexSearchMockResponse({
  distance: '22.4',
  startTime: '2026-09-01 14:30:00',
})

/** Guide §3.1 — required on every Partner → Refex call. */
export function refexAuthHeaders() {
  return {
    'client-id': refexClientId,
    'client-secret': refexClientSecret,
  }
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
    (Number(payload?.errorCode) === 200 ||
      (payload?.errorCode == null && carTypes.length >= 0 && data != null))

  return {
    ok: Boolean(ok && !isErrorShape),
    errorCode: isErrorShape ? null : payload?.errorCode ?? null,
    errorMessage: isErrorShape ? payload.error : payload?.errorMessage ?? null,
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

/** Staging-friendly defaults when journey params are incomplete. */
const REFEX_SEARCH_DEFAULTS = {
  tripMode: 'POINT TO POINT',
  pickUplat: 17.240041,
  pickUplon: 78.429251,
  droplat: 17.390873,
  droplon: 78.469006,
  pickUpAddress: 'hyderabad',
  dropAddress: 'hyderabad',
  pickUpCity: 'HYDERABAD',
  dropCity: 'HYDERABAD',
  distance: '40',
  pickUpPlaceId: '1',
  dropPlaceId: '1',
}

/**
 * Working staging curl — temporary until dynamic search.
 * POST …/thirdparty/v1/api/meeticket/search
 */
export const REFEX_HARDCODED_CURL_SEARCH = {
  PickUpPlaceId: '1',
  PickUpAddress: 'hyderabad',
  PickUplat: 17.240041,
  PickUplon: 78.429251,
  DropPlaceId: '1',
  DropAddress: 'hyderabad',
  Droplat: 17.390873,
  Droplon: 78.469006,
  TripMode: 'POINT TO POINT',
  StartTime: '2026-08-27 23:00:00',
  EndTime: '2026-08-27 23:50:00',
  Distance: '40',
  SearchId: 'Refex-test-1234asef2e5',
  VendorId: '2583',
  CorporateName: 'Mee Ticket',
  PickUpCity: 'HYDERABAD',
  DropCity: 'HYDERABAD',
  Epass_Status: '1',
}

export const REFEX_HARDCODED_CURL_AUTH = {
  'client-id': 'meeticket-refex-staging',
  'client-secret': 'wkbive3jgwarj4b775771bg7rvhi1f7o',
}

/** @deprecated use REFEX_HARDCODED_CURL_SEARCH */
export const REFEX_HARDCODED_TEST_TRIP = REFEX_HARDCODED_CURL_SEARCH

/**
 * Search request body — field names/casing match working Postman payload exactly:
 * PickUpPlaceId, PickUpAddress, PickUplat, PickUplon, DropPlaceId, DropAddress,
 * Droplat, Droplon, TripMode, StartTime, EndTime, Distance, SearchId, VendorId,
 * CorporateName, PickUpCity, DropCity, Epass_Status
 */
export function buildRefexSearchPayload({
  searchId,
  tripMode = REFEX_SEARCH_DEFAULTS.tripMode,
  startTime,
  endTime,
  pickUplat = REFEX_SEARCH_DEFAULTS.pickUplat,
  pickUplon = REFEX_SEARCH_DEFAULTS.pickUplon,
  droplat = REFEX_SEARCH_DEFAULTS.droplat,
  droplon = REFEX_SEARCH_DEFAULTS.droplon,
  pickUpAddress = REFEX_SEARCH_DEFAULTS.pickUpAddress,
  dropAddress = REFEX_SEARCH_DEFAULTS.dropAddress,
  pickUpPlaceId = REFEX_SEARCH_DEFAULTS.pickUpPlaceId,
  dropPlaceId = REFEX_SEARCH_DEFAULTS.dropPlaceId,
  pickUpCity = REFEX_SEARCH_DEFAULTS.pickUpCity,
  dropCity = REFEX_SEARCH_DEFAULTS.dropCity,
  distance = REFEX_SEARCH_DEFAULTS.distance,
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
    Distance: String(distance ?? REFEX_SEARCH_DEFAULTS.distance),
    SearchId: String(searchId),
    VendorId: String(vendorId ?? ''),
    CorporateName: String(corporateName || 'Mee Ticket'),
    PickUpCity: upperCity(pickUpCity),
    DropCity: upperCity(dropCity),
    Epass_Status: String(epassStatus ?? '1'),
  }
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
      distance: params.distance ?? REFEX_SEARCH_DEFAULTS.distance,
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
  console.info('[refex] search request', body)

  let payload
  try {
    payload = await PostRequest(urls.refexSearch, body, {
      signal,
      headers: refexAuthHeaders(),
    })
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

  const mapped = mapRefexSearchResponse(payload, { searchId })
  const noCars = mapped.ok && mapped.vehicles.length === 0

  if (import.meta.env.DEV && (!mapped.ok || noCars)) {
    console.warn('[refex] live search unavailable — using mock response', {
      errorMessage: mapped.errorMessage,
      carCount: mapped.vehicles.length,
    })
    const mockMapped = mapRefexSearchResponse(mockFromRequest(), { searchId })
    return {
      ...mockMapped,
      searchId,
      startTime,
      endTime,
      mock: true,
      mockReason: !mapped.ok ? 'api_error' : 'empty_car_types',
      liveErrorMessage: mapped.errorMessage,
    }
  }

  if (!mapped.ok) {
    throw new Error(mapped.errorMessage || 'Refex search failed')
  }

  if (mapped.vehicles.length === 0) {
    throw new Error('Refex search returned no vehicles')
  }

  return { ...mapped, searchId, startTime, endTime, mock: false }
}

/**
 * Hardcoded staging search — exact working curl payload (no geocode, no mock).
 */
export async function searchRefexHardcodedTest({ signal } = {}) {
  if (!urls.refexSearch) {
    throw new Error('VITE_REFEX_BASE_URL not set')
  }

  const body = { ...REFEX_HARDCODED_CURL_SEARCH }
  const searchId = body.SearchId

  console.info('[refex] hardcoded curl search', body)

  const payload = await PostRequest(urls.refexSearch, body, {
    signal,
    headers: REFEX_HARDCODED_CURL_AUTH,
  })

  const mapped = mapRefexSearchResponse(payload, { searchId })
  if (!mapped.ok) {
    throw new Error(mapped.errorMessage || 'Refex search failed')
  }
  if (mapped.vehicles.length === 0) {
    throw new Error('Refex search returned no vehicles')
  }

  return {
    ...mapped,
    searchId,
    startTime: body.StartTime,
    endTime: body.EndTime,
    mock: false,
  }
}

let hardcodedSearchCache = null
let hardcodedSearchInflight = null

/** Shared cache for hardcoded search — avoids duplicate calls across RouteCards. */
export function searchRefexHardcodedTestCached({ signal, refresh = false } = {}) {
  if (!refresh && hardcodedSearchCache) {
    return Promise.resolve(hardcodedSearchCache)
  }
  if (!refresh && hardcodedSearchInflight) {
    return hardcodedSearchInflight
  }

  hardcodedSearchInflight = searchRefexHardcodedTest({ signal })
    .then((result) => {
      hardcodedSearchCache = result
      return result
    })
    .finally(() => {
      hardcodedSearchInflight = null
    })

  return hardcodedSearchInflight
}

/**
 * MeeTicket Integration API — Block Cab.
 * POST …/thirdparty/v1/api/meeticket/block-cab
 * Echo search_id + vehicle_type + combustion_type + fares from Search exactly.
 */
export function buildRefexBlockCabPayload({
  searchId,
  vehicle,
  distanceKm,
  vendorId = REFEX_HARDCODED_CURL_SEARCH.VendorId || refexVendorId,
  partnerName = REFEX_HARDCODED_CURL_SEARCH.CorporateName || refexPartnerName,
  verificationCode,
} = {}) {
  const car = vehicle?.raw || vehicle
  const fare = car?.fare_details || vehicle?.fareDetails || {}
  const extras = fare.extra_charges || {}
  return {
    distance: Number(distanceKm ?? vehicle?.distanceKm ?? REFEX_HARDCODED_CURL_SEARCH.Distance) || 0,
    base_fare: Number(fare.base_fare ?? vehicle?.baseFareInr) || 0,
    state_tax: String(extras.state_tax?.amount ?? 0),
    toll_charges: Number(extras.toll_charges?.amount) || 0,
    total_fare: Number(fare.total_fare ?? vehicle?.fareInr) || 0,
    search_id: searchId || vehicle?.searchId || REFEX_HARDCODED_CURL_SEARCH.SearchId,
    vehicle_type: car?.type || vehicle?.vehicleType,
    model: car?.model || vehicle?.model,
    combustion_type: car?.combustion_type || vehicle?.combustionType,
    vendor_id: Number(vendorId) || vendorId,
    partner_name: partnerName || 'Mee Ticket',
    verification_code: verificationCode || String(Math.floor(1000 + Math.random() * 9000)),
  }
}

export async function blockRefexCab(params, { signal, useMock } = {}) {
  if (!urls.refexBlockCab && !useMock) {
    throw new Error('VITE_REFEX_BASE_URL not set')
  }

  const shouldMock = useMock === true || (!urls.refexBlockCab && useMock !== false)
  const body = buildRefexBlockCabPayload(params)

  console.info('[refex] block-cab', body)

  if (shouldMock) {
    return {
      ok: true,
      referenceNumber: '830BF643-A5AA-478F-B38C-AC8EDCBA14E7',
      verificationCode: body.verification_code,
      mock: true,
      raw: {
        response: {
          success: true,
          reference_number: '830BF643-A5AA-478F-B38C-AC8EDCBA14E7',
          verification_code: body.verification_code,
        },
        error: null,
        code: null,
      },
    }
  }

  const payload = await PostRequest(urls.refexBlockCab, body, {
    signal,
    headers: REFEX_HARDCODED_CURL_AUTH,
  })

  // Success: { response: { success, reference_number, verification_code }, error: null }
  // Failure: { response: null, error: "<message>", code: null }
  if (payload?.response === null && typeof payload?.error === 'string') {
    throw new Error(payload.error || 'Refex block-cab failed')
  }

  const response = payload?.response
  if (!response?.success || !response?.reference_number) {
    throw new Error(payload?.error || 'Refex block-cab failed')
  }

  return {
    ok: true,
    referenceNumber: response.reference_number,
    verificationCode: response.verification_code ?? body.verification_code,
    mock: false,
    raw: payload,
  }
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

  const payload = await PostRequest(urls.refexPayment, body, {
    signal,
    headers: refexAuthHeaders(),
  })

  const response = payload?.response
  if (!response?.success || !response?.job_no) {
    throw new Error(payload?.error || 'Refex payment failed')
  }

  return {
    ok: true,
    jobNo: response.job_no,
    vehicleRegistrationNumber: response.vehicle_registration_number ?? null,
    raw: payload,
  }
}
