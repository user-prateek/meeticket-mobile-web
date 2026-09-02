import { PostRequest } from './client'
import { ordersApiKey, ordersBaseUrl, urls } from './config'
import { getUserContext } from '../lib/userContext'
import { dedupeInFlight } from '../lib/dedupeRequest'
import { fetchDrivingEtaMinutes } from '../lib/drivingEta'

const LEG_TYPE = {
  metro: 'METRO',
  bus: 'RTC',
  cab: 'CAB',
  auto: 'CAB',
  bike: 'CAB',
}

const FIRST_MILE_MODES = new Set(['cab', 'auto', 'bike'])

const PAYMENT_MODE = 'ONLINE'

function ordersAuthHeaders() {
  if (!ordersApiKey) {
    throw new Error('Missing VITE_ORDERS_API_KEY')
  }
  return { 'X-API-Key': ordersApiKey }
}

function inrToPaise(inr) {
  const value = Number(inr)
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100)
}

function resolveUserId(profile) {
  const raw = profile?.userId ?? import.meta.env.VITE_ORDER_USER_ID ?? '1'
  if (raw == null || raw === '') return '1'
  const str = String(raw).trim()
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
    return str
  }
  const num = Number(str)
  return Number.isFinite(num) && /^\d+$/.test(str) ? num : str
}

function readPositiveInr(...values) {
  for (const value of values) {
    const amount = Number(value)
    if (Number.isFinite(amount) && amount > 0) return amount
  }
  return 0
}

function coord(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function stringId(value) {
  if (value == null || value === '') return ''
  return String(value)
}

function travelDate({ segment, trip } = {}) {
  if (trip?.travelDate) return String(trip.travelDate).slice(0, 10)
  const depart = segment?.departTime
  if (depart && /^\d{4}-\d{2}-\d{2}/.test(String(depart))) {
    return String(depart).slice(0, 10)
  }
  return new Date().toISOString().slice(0, 10)
}

function formatOrderDateTime(date) {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function parseOrderDateTime(value) {
  if (!value) return null
  const d = new Date(String(value).replace(' ', 'T'))
  return Number.isNaN(d.getTime()) ? null : d
}

function segmentDateTime(segment, trip, timeValue) {
  if (timeValue == null || timeValue === '') return null
  const raw = String(timeValue).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const parsed = parseOrderDateTime(raw)
    return parsed ? formatOrderDateTime(parsed) : null
  }
  const date = travelDate({ segment, trip })
  const time = /^\d{1,2}:\d{2}$/.test(raw) ? `${raw}:00` : raw
  return `${date} ${time}`
}

function resolveTransitLegTimes(segment, trip, chainStartDate) {
  const startFromApi = segmentDateTime(segment, trip, segment.departTime)
  const endFromApi = segmentDateTime(segment, trip, segment.arrivalTime)
  if (startFromApi && endFromApi) {
    return {
      ExpectedStartTime: startFromApi,
      ExpectedEndTime: endFromApi,
    }
  }

  const startDate =
    chainStartDate || parseOrderDateTime(startFromApi) || new Date()
  const durationMin = Math.max(Number(segment.durationMin) || 0, 1)
  const endDate = new Date(startDate.getTime() + durationMin * 60 * 1000)

  return {
    ExpectedStartTime: formatOrderDateTime(startDate),
    ExpectedEndTime: formatOrderDateTime(endDate),
  }
}

async function resolveCabLegTimes({ journey, trip, lastMile, selectedVehicle }) {
  const legInfo = buildCabLegInfo({ journey, trip, lastMile })
  const start = new Date()
  let durationMin =
    Number(selectedVehicle?.etaMin) ||
    Number(journey?.access?.durationMin) ||
    null

  const hasCoords = [legInfo.pickup_lat, legInfo.pickup_lng, legInfo.drop_lat, legInfo.drop_lng].every(
    (value) => value != null,
  )

  if (hasCoords) {
    try {
      const eta = await fetchDrivingEtaMinutes({
        fromLat: legInfo.pickup_lat,
        fromLng: legInfo.pickup_lng,
        toLat: legInfo.drop_lat,
        toLng: legInfo.drop_lng,
      })
      if (eta > 0) durationMin = eta
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[orders] Google driving ETA failed — using fallback duration', error)
      }
    }
  }

  if (!durationMin || durationMin <= 0) durationMin = 15

  const end = new Date(start.getTime() + durationMin * 60 * 1000)
  return {
    ExpectedStartTime: formatOrderDateTime(start),
    ExpectedEndTime: formatOrderDateTime(end),
  }
}

function buildMetroLegInfo(segment, trip, { metroBearerToken } = {}) {
  const leg = {
    source_station_code: stringId(segment.fromStationCode || segment.fromId),
    destination_station_code: stringId(segment.toStationCode || segment.toId),
    travel_date: travelDate({ segment, trip }),
    FromLocName: stringId(segment.from),
    ToLocName: stringId(segment.to),
  }
  const token = String(metroBearerToken || '').trim()
  if (token) leg.metro_bearer_token = token
  return leg
}

function buildRtcLegInfo(segment, trip) {
  return {
    source_stop_id: stringId(segment.fromId),
    destination_stop_id: stringId(segment.toId),
    route_id: stringId(segment.routeId || segment.routeShortName),
    travel_date: travelDate({ segment, trip }),
    FromLocName: stringId(segment.from),
    ToLocName: stringId(segment.to),
  }
}

function buildCabLegInfo({ journey, trip, lastMile }) {
  const mile = journey?.access
  const accessRaw = journey?.raw?.access

  const pickup_lat = coord(mile?.fromLat ?? trip?.fromLat ?? accessRaw?.from_lat)
  const pickup_lng = coord(mile?.fromLon ?? trip?.fromLon ?? accessRaw?.from_lon)
  const drop_lat = coord(mile?.toLat ?? accessRaw?.to_lat)
  const drop_lng = coord(mile?.toLon ?? accessRaw?.to_lon)

  return {
    provider: lastMile?.providerId || 'internal_fleet',
    pickup_lat,
    pickup_lng,
    drop_lat,
    drop_lng,
    FromLocName: stringId(mile?.fromLabel ?? trip?.fromPlace),
    ToLocName: stringId(mile?.toLabel ?? journey?.originStation),
  }
}

function readChargeAmount(charge) {
  if (charge == null) return 0
  if (typeof charge === 'object') return Number(charge.amount) || 0
  return Number(charge) || 0
}

function compactRecord(record) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value != null && value !== ''),
  )
}

/**
 * Provider-specific cab metadata for orders API `agg_specific_info`.
 */
function buildCabAggSpecificInfo({ lastMile, selectedVehicle }) {
  if (!selectedVehicle) return null

  const providerId = lastMile?.providerId || selectedVehicle.providerId
  const fareDetails = selectedVehicle.fareDetails
  const extraCharges = fareDetails?.extra_charges || {}
  const totalFare = readPositiveInr(selectedVehicle.fareInr, lastMile?.fareInr)
  const baseFare = readPositiveInr(
    selectedVehicle.baseFareInr,
    fareDetails?.base_fare,
    totalFare,
  )
  const distance = Number(selectedVehicle.distanceKm)

  if (providerId === 'refex') {
    return compactRecord({
      distance: Number.isFinite(distance) && distance > 0 ? distance : undefined,
      base_fare: baseFare || undefined,
      state_tax: String(readChargeAmount(extraCharges.state_tax) || 0),
      toll_charges: readChargeAmount(extraCharges.toll_charges),
      total_fare: totalFare || undefined,
      search_id: stringId(selectedVehicle.searchId || lastMile?.refexSearchId) || undefined,
      vehicle_type: selectedVehicle.vehicleType || undefined,
      model: selectedVehicle.model || undefined,
      combustion_type: selectedVehicle.combustionType || undefined,
    })
  }

  if (providerId === 'ola') {
    return compactRecord({
      distance: Number.isFinite(distance) && distance > 0 ? distance : undefined,
      base_fare: baseFare || undefined,
      total_fare: totalFare || undefined,
      search_id: stringId(selectedVehicle.fareId) || undefined,
      vehicle_type: selectedVehicle.categoryId || selectedVehicle.mode || undefined,
      model: selectedVehicle.label || undefined,
    })
  }

  return compactRecord({
    distance: Number.isFinite(distance) && distance > 0 ? distance : undefined,
    total_fare: totalFare || undefined,
    vehicle_type: selectedVehicle.mode || undefined,
    model: selectedVehicle.label || undefined,
  })
}

function blockFareInrForMode(journey, mode) {
  const block = mode === 'bus' ? journey?.raw?.bus : mode === 'metro' ? journey?.raw?.metro : null
  return readPositiveInr(block?.total_fare, block?.fare, block?.ticket_fare)
}

function transitSegments(journey) {
  return (journey?.segments || []).filter((segment) => segment.mode === 'bus' || segment.mode === 'metro')
}

function isSingleTransitMode(journey) {
  const modes = new Set(transitSegments(journey).map((segment) => segment.mode))
  return modes.size === 1
}

function journeyTransitFareInr(journey) {
  return readPositiveInr(journey?.totalFareInr, journey?.payment?.amountInr)
}

/**
 * Optional first mile (cab/auto/bike) — always leg 1 when selected.
 */
export function hasFirstMileLeg({ lastMile, selectedVehicle }) {
  if (!lastMile?.providerId || !selectedVehicle) return false
  if (!FIRST_MILE_MODES.has(selectedVehicle.mode)) return false
  return inrToPaise(selectedVehicle.fareInr ?? lastMile.fareInr) > 0
}

function buildFirstMileLeg({ journey, trip, lastMile, selectedVehicle }) {
  if (!hasFirstMileLeg({ lastMile, selectedVehicle })) return null

  const amount_paise = inrToPaise(selectedVehicle.fareInr ?? lastMile.fareInr)
  const leg_info = buildCabLegInfo({ journey, trip, lastMile })

  if ([leg_info.pickup_lat, leg_info.pickup_lng, leg_info.drop_lat, leg_info.drop_lng].some((v) => v == null)) {
    throw new Error('First-mile pickup/drop coordinates are missing')
  }

  const agg_specific_info = buildCabAggSpecificInfo({ lastMile, selectedVehicle })

  const leg = {
    leg_type: 'CAB',
    leg_info,
    amount_paise,
    payment_mode: PAYMENT_MODE,
  }

  if (agg_specific_info && Object.keys(agg_specific_info).length) {
    leg.agg_specific_info = agg_specific_info
  }

  return leg
}

/**
 * Split a block fare across hops that do not already have per-hop fares.
 * Keeps every hop > 0 paise to satisfy orders API validation.
 */
function distributeRemainingFare(modeSegments, blockFareInr, assigned) {
  const knownSum = modeSegments.reduce((sum, segment) => sum + (assigned.get(segment.id) || 0), 0)
  const missing = modeSegments.filter((segment) => !(assigned.get(segment.id) > 0))
  let remaining = blockFareInr - knownSum

  if (remaining <= 0) {
    if (knownSum <= 0 && missing.length === modeSegments.length && blockFareInr > 0) {
      remaining = blockFareInr
    } else {
      return
    }
  }

  if (!missing.length) return

  const base = Math.floor(remaining / missing.length)
  let leftover = remaining - base * missing.length

  missing.forEach((segment, index) => {
    let fare = base
    if (index === 0) fare += leftover
    assigned.set(segment.id, Math.max(fare, 1))
  })
}

function resolveTransitFareMap(journey) {
  const segments = transitSegments(journey)
  const assigned = new Map()

  for (const mode of ['bus', 'metro']) {
    const modeSegments = segments.filter((segment) => segment.mode === mode)
    if (!modeSegments.length) continue

    modeSegments.forEach((segment) => {
      const fare = readPositiveInr(segment.fareInr)
      if (fare > 0) assigned.set(segment.id, fare)
    })

    let blockFare = blockFareInrForMode(journey, mode)
    if (blockFare <= 0 && modeSegments.length && isSingleTransitMode(journey)) {
      blockFare = journeyTransitFareInr(journey)
    }

    distributeRemainingFare(modeSegments, blockFare, assigned)
  }

  return assigned
}

function buildTransitLegInfo(segment, trip, { metroBearerToken } = {}) {
  if (segment.mode === 'metro') return buildMetroLegInfo(segment, trip, { metroBearerToken })
  if (segment.mode === 'bus') return buildRtcLegInfo(segment, trip)
  return null
}

/**
 * Bus / metro hops in journey order — each hop is one orders API leg.
 * First mile is handled separately and prepended.
 */
function buildTransitLegs(journey, trip, { chainStart, metroBearerToken } = {}) {
  const fareBySegmentId = resolveTransitFareMap(journey)
  const legs = []
  let nextChainStart = chainStart ? parseOrderDateTime(chainStart) : null

  for (const segment of transitSegments(journey)) {
    const amount_paise = inrToPaise(fareBySegmentId.get(segment.id))
    if (amount_paise <= 0) continue

    const leg_info = buildTransitLegInfo(segment, trip, { metroBearerToken })
    if (!leg_info) continue

    const times = resolveTransitLegTimes(segment, trip, nextChainStart)
    Object.assign(leg_info, times)
    nextChainStart = parseOrderDateTime(times.ExpectedEndTime)

    legs.push({
      leg_type: LEG_TYPE[segment.mode] || String(segment.mode || '').toUpperCase(),
      leg_info,
      amount_paise,
      payment_mode: PAYMENT_MODE,
    })
  }

  return legs
}

export async function buildOrderPayload({ journey, trip, lastMile, selectedVehicle, user }) {
  const profile = user || getUserContext() || {}
  const metroBearerToken = profile.metroBearerToken || ''
  const legs = []

  const firstMileLeg = buildFirstMileLeg({ journey, trip, lastMile, selectedVehicle })
  let chainStart = null

  if (firstMileLeg) {
    const cabTimes = await resolveCabLegTimes({ journey, trip, lastMile, selectedVehicle })
    Object.assign(firstMileLeg.leg_info, cabTimes)
    chainStart = cabTimes.ExpectedEndTime
    legs.push(firstMileLeg)
  }

  legs.push(...buildTransitLegs(journey, trip, { chainStart, metroBearerToken }))

  if (!legs.length) {
    const hasTransit = transitSegments(journey).length > 0
    const hasFirstMileSelection = Boolean(lastMile?.providerId && selectedVehicle)
    if (hasTransit) {
      throw new Error('Transit fare is unavailable for this journey')
    }
    if (hasFirstMileSelection) {
      throw new Error('Select a ride option with a valid fare')
    }
    throw new Error('Add a bus or metro journey, or select a first-mile ride')
  }

  const invalidLeg = legs.find((leg) => !leg.amount_paise || leg.amount_paise <= 0)
  if (invalidLeg) {
    throw new Error(`Invalid fare for ${invalidLeg.leg_type} leg`)
  }

  return {
    user_id: resolveUserId(profile),
    name: profile.name || import.meta.env.VITE_ORDER_USER_NAME || 'Test User',
    mobile: profile.mobile || import.meta.env.VITE_ORDER_USER_MOBILE || '8755993810',
    email: profile.email || import.meta.env.VITE_ORDER_USER_EMAIL || 'test@example.com',
    legs,
  }
}

export async function createOrder(payload, { signal, journeyId } = {}) {
  if (!urls.orders) {
    throw new Error('Orders API URL is not configured')
  }

  if (import.meta.env.DEV) {
    console.info('[orders] POST', urls.orders, { payload })
  }

  const data = await PostRequest(urls.orders, payload, {
    signal,
    headers: ordersAuthHeaders(),
  })

  return normalizeOrderResponse(data, { journeyId })
}

/**
 * Keep the full POST /api/orders body for follow-up calls (order_id, legs, status, …).
 * Adds `orderId` alias and session metadata without dropping API fields.
 */
export function normalizeOrderResponse(data, { journeyId } = {}) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid order response')
  }

  const order_id = data.order_id ?? data.orderId
  if (!order_id) {
    throw new Error('Order response missing order_id')
  }

  return {
    ...data,
    order_id,
    orderId: order_id,
    journeyId: journeyId ?? data.journeyId ?? null,
    createdAt: data.createdAt ?? Date.now(),
  }
}

/** order_id for subsequent API calls — from session order or booking. */
export function getOrderId(order) {
  if (!order) return null
  return order.orderId ?? order.order_id ?? null
}

export function orderPgInitiateUrl(orderId) {
  const id = getOrderId({ order_id: orderId, orderId }) ?? orderId
  if (!urls.orders || !id) return ''
  return `${urls.orders}/${encodeURIComponent(id)}/pg/initiate`
}

export function orderPgStatusUrl(orderId) {
  const id = getOrderId({ order_id: orderId, orderId }) ?? orderId
  if (!urls.orders || !id) return ''
  return `${urls.orders}/${encodeURIComponent(id)}/pg/status`
}

/** GET /api/pg/callback?order_id=… — Paytm redirect target (returns JSON). */
export function pgCallbackUrl(orderId) {
  const id = getOrderId({ order_id: orderId, orderId }) ?? orderId
  if (!ordersBaseUrl || !id) return ''
  return `${ordersBaseUrl}/api/pg/callback?order_id=${encodeURIComponent(id)}`
}

/**
 * Acknowledge Paytm callback server-side. Safe to call from our redirect page;
 * Paytm may have already hit this URL before the user lands on our UI.
 */
export async function acknowledgePgCallback(orderId, { signal } = {}) {
  const url = pgCallbackUrl(orderId)
  if (!url) throw new Error('PG callback URL is not configured')

  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
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
    const message =
      (data && typeof data === 'object' && (data.error || data.message)) ||
      text?.slice(0, 200) ||
      `Callback failed (${response.status})`
    throw new Error(String(message))
  }

  return data
}

export function orderBookUrl(orderId) {
  const id = getOrderId({ order_id: orderId, orderId }) ?? orderId
  if (!urls.orders || !id) return ''
  return `${urls.orders}/${encodeURIComponent(id)}/book`
}

/**
 * POST /api/orders/{order_id}/pg/initiate — start online payment for an order.
 * Matches curl: POST with X-API-Key header only (no JSON body).
 */
export async function initiateOrderPg(orderId, { signal } = {}) {
  const url = orderPgInitiateUrl(orderId)
  if (!url) {
    throw new Error('Orders API URL is not configured')
  }

  const resolvedOrderId = getOrderId({ order_id: orderId, orderId }) ?? orderId

  if (import.meta.env.DEV) {
    console.info('[orders] POST', url, { orderId: resolvedOrderId, headers: ['X-API-Key'] })
  }

  const data = await PostRequest(url, null, {
    signal,
    noBody: true,
    headers: ordersAuthHeaders(),
  })

  return normalizePgInitiateResponse(data, { orderId: resolvedOrderId })
}

/**
 * POST /api/orders/{order_id}/pg/status — payment status (poll after Paytm checkout).
 */
export async function fetchOrderPgStatus(orderId, { signal } = {}) {
  const url = orderPgStatusUrl(orderId)
  if (!url) throw new Error('Orders API URL is not configured')

  const resolvedOrderId = getOrderId({ order_id: orderId, orderId }) ?? orderId

  return dedupeInFlight(`pg-status:${resolvedOrderId}`, async () => {
    if (import.meta.env.DEV) {
      console.info('[orders] POST', url, { orderId: resolvedOrderId, headers: ['X-API-Key'] })
    }

    const data = await PostRequest(url, null, {
      signal,
      noBody: true,
      headers: ordersAuthHeaders(),
    })

    return normalizePgStatusResponse(data, { orderId: resolvedOrderId })
  })
}

export function normalizePgStatusResponse(data, { orderId } = {}) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid PG status response')
  }

  return {
    ...data,
    orderId: data.order_id ?? orderId ?? null,
    pgStatus: data.pg_status ?? data.pgStatus ?? null,
    checkedAt: Date.now(),
  }
}

/** Keep polling while backend is still booking one or more legs. */
export function shouldContinuePgPolling(pgStatus) {
  return pgStatus?.ispolling === true || pgStatus?.ispolling === 'true'
}

export function isPgPaymentFailed(pgStatus) {
  const pg = String(pgStatus?.pg_status ?? pgStatus?.pgStatus ?? '').toUpperCase()
  const result = String(pgStatus?.pg_response?.body?.resultInfo?.resultStatus ?? '').toUpperCase()
  const code = pg || result
  return ['TXN_FAILURE', 'FAILED', 'FAILURE', 'TXN_FAILED', 'CANCELLED', 'CLOSED'].includes(code)
}

export function isPgPaymentSuccessful(pgStatus) {
  const pg = String(pgStatus?.pg_status ?? pgStatus?.pgStatus ?? '').toUpperCase()
  const result = String(pgStatus?.pg_response?.body?.resultInfo?.resultStatus ?? '').toUpperCase()
  const code = pg || result
  return ['TXN_SUCCESS', 'SUCCESS', 'PAID', 'COMPLETED'].includes(code)
}

const LEG_CONFIRMED = new Set(['CONFIRMED', 'SUCCESS', 'BOOKED', 'COMPLETED'])
const LEG_FAILED = new Set(['FAILED', 'FAILURE', 'CANCELLED'])

export function classifyLegBooking(leg) {
  const status = String(leg?.status ?? '').toUpperCase()
  if (LEG_CONFIRMED.has(status)) return 'confirmed'
  if (LEG_FAILED.has(status)) return 'failed'
  return 'pending'
}

/** Payment succeeded but no leg was confirmed when polling finished. */
export function isBookingUnsuccessful(pgStatus) {
  if (!isPgPaymentSuccessful(pgStatus)) return false
  if (shouldContinuePgPolling(pgStatus)) return false
  const legs = pgStatus?.bookings ?? []
  if (!legs.length) return true
  return !legs.some((leg) => classifyLegBooking(leg) === 'confirmed')
}

export function hasConfirmedBookings(pgStatus) {
  return (pgStatus?.bookings ?? []).some((leg) => classifyLegBooking(leg) === 'confirmed')
}

/** @deprecated Use isPgPaymentFailed / shouldContinuePgPolling */
export function resolvePgStatusOutcome(pgStatus) {
  if (isPgPaymentFailed(pgStatus)) return 'failure'
  if (shouldContinuePgPolling(pgStatus)) return 'pending'
  if (isPgPaymentSuccessful(pgStatus)) return 'success'
  return 'pending'
}

/**
 * POST /api/orders/{order_id}/book — confirm legs after successful payment.
 */
export async function bookOrder(orderId, { signal } = {}) {
  const url = orderBookUrl(orderId)
  if (!url) throw new Error('Orders API URL is not configured')

  const resolvedOrderId = getOrderId({ order_id: orderId, orderId }) ?? orderId
  if (import.meta.env.DEV) {
    console.info('[orders] POST', url, { orderId: resolvedOrderId, headers: ['X-API-Key'] })
  }

  const data = await PostRequest(url, null, {
    signal,
    noBody: true,
    headers: ordersAuthHeaders(),
  })

  return normalizeBookResponse(data, { orderId: resolvedOrderId })
}

export function normalizeBookResponse(data, { orderId } = {}) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid book response')
  }

  if (data.success === false) {
    throw new Error(data.message || data.error || 'Booking failed')
  }

  return {
    ...data,
    orderId: data.order_id ?? orderId ?? null,
    bookedAt: Date.now(),
  }
}

export function pgFailureMessage(pgStatus) {
  return (
    pgStatus?.pg_response?.body?.resultInfo?.resultMsg ||
    pgStatus?.message ||
    pgStatus?.error ||
    'We’re sorry! It seems there is some problem with your payment. Please retry or choose another payment option.'
  )
}

export function pgOrderRef(pgStatus) {
  return pgStatus?.order_id || pgStatus?.txn_id || null
}

export function normalizePgInitiateResponse(data, { orderId } = {}) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid PG initiate response')
  }

  if (data.success === false) {
    throw new Error(data.message || data.error || 'PG initiate failed')
  }

  const pgdata = data.pgdata ?? data.pgData ?? null
  if (!pgdata) {
    throw new Error('PG initiate response missing pgdata')
  }

  return {
    ...data,
    success: data.success !== false,
    pgdata,
    orderId: pgdata.order_id ?? orderId ?? data.order_id ?? data.orderId ?? null,
    mid: pgdata.mid ?? null,
    txnToken: pgdata.txnToken ?? pgdata.txn_token ?? null,
    amount: pgdata.amount ?? null,
    checkoutJsUrl: pgdata.checkoutJsUrl ?? pgdata.checkout_js_url ?? null,
    initiatedAt: Date.now(),
  }
}

/** Paytm fields from pg/initiate — used by checkout iframe. */
export function getPaytmPgData(pgInitiate) {
  const pg = pgInitiate?.pgdata ?? pgInitiate?.pgData ?? {}
  return {
    orderId: pg.order_id ?? pgInitiate?.orderId ?? null,
    mid: pg.mid ?? pgInitiate?.mid ?? null,
    txnToken: pg.txnToken ?? pg.txn_token ?? pgInitiate?.txnToken ?? null,
    amount: pg.amount ?? pgInitiate?.amount ?? null,
    checkoutJsUrl: pg.checkoutJsUrl ?? pg.checkout_js_url ?? pgInitiate?.checkoutJsUrl ?? null,
  }
}

export function orderDetailUrl(orderId) {
  const id = getOrderId({ order_id: orderId, orderId }) ?? orderId
  if (!urls.orders || !id) return ''
  return `${urls.orders}/${encodeURIComponent(id)}`
}

async function ordersGet(url, { signal } = {}) {
  let response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', ...ordersAuthHeaders() },
      signal,
    })
  } catch (error) {
    const err = new Error(error?.message || 'Network request failed')
    err.cause = error
    throw err
  }

  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }

  if (!response.ok) {
    const message =
      (data && typeof data === 'object' && (data.error || data.message)) ||
      text?.slice(0, 200) ||
      `Request failed (${response.status})`
    const err = new Error(String(message))
    err.status = response.status
    err.body = data
    throw err
  }

  return data
}

/** GET /api/orders/{order_id} — poll payment / booking status. */
export async function fetchOrder(orderId, { signal } = {}) {
  const url = orderDetailUrl(orderId)
  if (!url) throw new Error('Orders API URL is not configured')
  return ordersGet(url, { signal })
}

export function isOrderPaymentComplete(order) {
  const pgStatus = String(order?.pg_status ?? order?.pgStatus ?? '').toUpperCase()
  const status = String(order?.status ?? '').toUpperCase()
  if (['SUCCESS', 'TXN_SUCCESS', 'PAID', 'COMPLETED'].includes(pgStatus)) return true
  if (['PAID', 'COMPLETED', 'CONFIRMED'].includes(status)) return true
  return false
}

/** Create order then POST …/pg/initiate — used on Confirm Multi Model. */
export async function createOrderAndInitiatePg(payload, { signal, journeyId } = {}) {
  const order = await createOrder(payload, { signal, journeyId })
  const pgInitiate = await initiateOrderPg(getOrderId(order), { signal })
  return { ...order, pgInitiate }
}
