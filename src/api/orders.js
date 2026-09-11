import { PostRequest } from './client'
import { ordersApiKey, ordersBaseUrl, urls } from './config'
import { isPayAtPickupVehicle } from '../constants/lastMile'
import { getAppContext } from '../lib/appContext'
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
const PAYMENT_MODE_CASH = 'CASH'

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
  if (value == null || value === '') return null
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
  const isDrop = lastMile?.serviceId === 'drop'
  const start = new Date()
  let durationMin =
    Number(selectedVehicle?.etaMin) ||
    Number(isDrop ? journey?.egress?.durationMin : journey?.access?.durationMin) ||
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

function buildMetroLegInfo(segment, trip, { metroBearerToken, stopCoords } = {}) {
  const leg = {
    source_station_code: stringId(segment.fromStationCode || segment.fromId),
    destination_station_code: stringId(segment.toStationCode || segment.toId),
    travel_date: travelDate({ segment, trip }),
    FromLocName: stringId(segment.from),
    ToLocName: stringId(segment.to),
  }
  const token = String(metroBearerToken || '').trim()
  if (token) leg.metro_bearer_token = token

  const sourceLat = coord(stopCoords?.sourceLat)
  const sourceLng = coord(stopCoords?.sourceLng)
  const destLat = coord(stopCoords?.destLat)
  const destLng = coord(stopCoords?.destLng)
  if (sourceLat != null) leg.source_station_lat = sourceLat
  if (sourceLng != null) leg.source_station_lng = sourceLng
  if (destLat != null) leg.destination_station_lat = destLat
  if (destLng != null) leg.destination_station_lng = destLng

  return leg
}

function buildRtcLegInfo(segment, trip, { stopCoords } = {}) {
  const leg = {
    source_stop_id: stringId(segment.fromId),
    destination_stop_id: stringId(segment.toId),
    route_id: stringId(segment.routeId || segment.routeShortName),
    travel_date: travelDate({ segment, trip }),
    FromLocName: stringId(segment.from),
    ToLocName: stringId(segment.to),
  }

  const tripId = stringId(segment.tripId)
  const tripInstanceId = stringId(segment.tripInstanceId)
  if (tripId) leg.trip_id = tripId
  if (tripInstanceId) leg.trip_instance_id = tripInstanceId

  const sourceLat = coord(stopCoords?.sourceLat)
  const sourceLng = coord(stopCoords?.sourceLng)
  const destLat = coord(stopCoords?.destLat)
  const destLng = coord(stopCoords?.destLng)
  if (sourceLat != null) leg.source_stop_lat = sourceLat
  if (sourceLng != null) leg.source_stop_lng = sourceLng
  if (destLat != null) leg.destination_stop_lat = destLat
  if (destLng != null) leg.destination_stop_lng = destLng

  return leg
}

/** Order-level overall journey pickup/drop (required by POST /orders). */
function resolveOrderPickupDrop({ journey, trip }) {
  const access = journey?.access
  const egress = journey?.egress
  const accessRaw = journey?.raw?.access
  const egressRaw = journey?.raw?.egress

  return {
    pickup_lat: coord(access?.fromLat ?? trip?.fromLat ?? accessRaw?.from_lat),
    pickup_lng: coord(
      access?.fromLon ?? trip?.fromLon ?? trip?.fromLng ?? accessRaw?.from_lon,
    ),
    pickup_place_name: stringId(access?.fromLabel ?? trip?.fromPlace) || undefined,
    drop_lat: coord(egress?.toLat ?? trip?.toLat ?? egressRaw?.to_lat),
    drop_lng: coord(egress?.toLon ?? trip?.toLon ?? trip?.toLng ?? egressRaw?.to_lon),
    drop_place_name: stringId(egress?.toLabel ?? trip?.toPlace) || undefined,
  }
}

/**
 * Station/stop coords for a transit hop.
 * Prefer access.to / egress.from; for mix (2 hops) fill the middle from `raw.transfer`.
 */
function resolveTransitStopCoords(journey, index, transitCount) {
  const access = journey?.access
  const egress = journey?.egress
  const accessRaw = journey?.raw?.access
  const egressRaw = journey?.raw?.egress
  const transfer = journey?.raw?.transfer

  const boardLat = coord(access?.toLat ?? accessRaw?.to_lat)
  const boardLng = coord(access?.toLon ?? accessRaw?.to_lon)
  const alightLat = coord(egress?.fromLat ?? egressRaw?.from_lat)
  const alightLng = coord(egress?.fromLon ?? egressRaw?.from_lon)

  const isFirst = index === 0
  const isLast = index === transitCount - 1

  if (transitCount <= 1) {
    return {
      sourceLat: boardLat,
      sourceLng: boardLng,
      destLat: alightLat,
      destLng: alightLng,
    }
  }

  const transferFromLat = coord(transfer?.from_lat)
  const transferFromLng = coord(transfer?.from_lon)
  const transferToLat = coord(transfer?.to_lat)
  const transferToLng = coord(transfer?.to_lon)

  return {
    sourceLat: isFirst ? boardLat : transferToLat,
    sourceLng: isFirst ? boardLng : transferToLng,
    destLat: isLast ? alightLat : transferFromLat,
    destLng: isLast ? alightLng : transferFromLng,
  }
}

function buildCabLegInfo({ journey, trip, lastMile }) {
  const isDrop = lastMile?.serviceId === 'drop'
  const mile = isDrop ? journey?.egress : journey?.access
  const mileRaw = isDrop ? journey?.raw?.egress : journey?.raw?.access

  // Pickup: access = user origin A; drop = alighting station M′.
  const pickup_lat = coord(
    mile?.fromLat ?? (isDrop ? null : trip?.fromLat) ?? mileRaw?.from_lat,
  )
  const pickup_lng = coord(
    mile?.fromLon ??
      (isDrop ? null : trip?.fromLon ?? trip?.fromLng) ??
      mileRaw?.from_lon,
  )
  // Drop: access = boarding station M; drop = destination B.
  const drop_lat = coord(
    mile?.toLat ?? (isDrop ? trip?.toLat : null) ?? mileRaw?.to_lat,
  )
  const drop_lng = coord(
    mile?.toLon ??
      (isDrop ? trip?.toLon ?? trip?.toLng : null) ??
      mileRaw?.to_lon,
  )

  return {
    provider: lastMile?.providerId || 'internal_fleet',
    pickup_lat,
    pickup_lng,
    drop_lat,
    drop_lng,
    FromLocName: stringId(
      mile?.fromLabel ?? (isDrop ? journey?.destinationStation : trip?.fromPlace),
    ),
    ToLocName: stringId(
      mile?.toLabel ?? (isDrop ? trip?.toPlace : journey?.originStation),
    ),
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
    const min = readPositiveInr(selectedVehicle.fareInr, lastMile?.fareInr)
    const max = readPositiveInr(selectedVehicle.fareMaxInr, min)
    return compactRecord({
      distance: Number.isFinite(distance) && distance > 0 ? distance : undefined,
      amount_min: min || undefined,
      amount_max: max || undefined,
      // Estimate only — cash to driver; not charged via Paytm.
      total_fare: undefined,
      search_id: stringId(selectedVehicle.fareId) || undefined,
      vehicle_type: selectedVehicle.categoryId || selectedVehicle.mode || undefined,
      model: selectedVehicle.label || undefined,
      payment_mode: 'CASH',
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
  if (mode === 'metro') {
    // Charge metro.total_fare only (e.g. 51), not sum of leg.fare (28+37).
    return readPositiveInr(block?.total_fare)
  }
  return readPositiveInr(block?.total_fare, block?.fare, block?.ticket_fare)
}

function transitSegments(journey) {
  return (journey?.segments || []).filter((segment) => segment.mode === 'bus' || segment.mode === 'metro')
}

/**
 * Metro through-ticket: 2+ metro hops (e.g. NAM→AME, AME→HTC) book as one station-to-station
 * METRO leg at metro.total_fare. Never merge cab or bus — those are separate operator tickets.
 */
function collapseThroughMetroHops(segments) {
  if (segments.length < 2) return segments
  if (!segments.every((segment) => segment.mode === 'metro')) return segments

  const first = segments[0]
  const last = segments[segments.length - 1]
  const durationMin = segments.reduce(
    (sum, segment) => sum + (Number(segment.durationMin) || 0),
    0,
  )

  return [
    {
      ...first,
      to: last.to,
      toId: last.toId,
      toStationCode: last.toStationCode || last.toId,
      arrivalTime: last.arrivalTime,
      durationMin: durationMin || first.durationMin,
      fareInr: undefined,
    },
  ]
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
 * Cash providers (Ola) still count as a selected first-mile leg for UX / cab review.
 */
export function hasFirstMileLeg({ lastMile, selectedVehicle }) {
  if (!lastMile?.providerId || !selectedVehicle) return false
  if (!FIRST_MILE_MODES.has(selectedVehicle.mode)) return false
  if (isPayAtPickupVehicle(selectedVehicle)) return true
  return inrToPaise(selectedVehicle.fareInr ?? lastMile.fareInr) > 0
}

function buildFirstMileLeg({ journey, trip, lastMile, selectedVehicle }) {
  if (!hasFirstMileLeg({ lastMile, selectedVehicle })) return null

  const payAtPickup = isPayAtPickupVehicle(selectedVehicle)
  // Cash rides are not collected online — amount_paise stays 0 for Paytm.
  const amount_paise = payAtPickup ? 0 : inrToPaise(selectedVehicle.fareInr ?? lastMile.fareInr)
  const leg_info = buildCabLegInfo({ journey, trip, lastMile })

  if ([leg_info.pickup_lat, leg_info.pickup_lng, leg_info.drop_lat, leg_info.drop_lng].some((v) => v == null)) {
    throw new Error('First-mile pickup/drop coordinates are missing')
  }

  const agg_specific_info = buildCabAggSpecificInfo({ lastMile, selectedVehicle })

  const leg = {
    leg_type: 'CAB',
    leg_info,
    amount_paise,
    payment_mode: payAtPickup ? PAYMENT_MODE_CASH : PAYMENT_MODE,
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

function resolveTransitFareMap(journey, segments = transitSegments(journey)) {
  const assigned = new Map()

  for (const mode of ['bus', 'metro']) {
    const modeSegments = segments.filter((segment) => segment.mode === mode)
    if (!modeSegments.length) continue

    let blockFare = blockFareInrForMode(journey, mode)
    if (blockFare <= 0 && modeSegments.length && isSingleTransitMode(journey)) {
      blockFare = journeyTransitFareInr(journey)
    }

    if (mode === 'metro' && blockFare > 0) {
      // Always collect metro.total_fare across hops — ignore any leg.fare values.
      distributeRemainingFare(modeSegments, blockFare, assigned)
      continue
    }

    modeSegments.forEach((segment) => {
      const fare = readPositiveInr(segment.fareInr)
      if (fare > 0) assigned.set(segment.id, fare)
    })

    distributeRemainingFare(modeSegments, blockFare, assigned)
  }

  return assigned
}

function buildTransitLegInfo(segment, trip, { metroBearerToken, stopCoords } = {}) {
  if (segment.mode === 'metro') {
    return buildMetroLegInfo(segment, trip, { metroBearerToken, stopCoords })
  }
  if (segment.mode === 'bus') {
    return buildRtcLegInfo(segment, trip, { stopCoords })
  }
  return null
}

/**
 * Bus / metro hops in journey order — each booked hop is one orders API leg.
 * Consecutive metro hops collapse to one through-ticket. Cab is prepended separately.
 */
function buildTransitLegs(journey, trip, { chainStart, metroBearerToken } = {}) {
  const segments = collapseThroughMetroHops(transitSegments(journey))
  const fareBySegmentId = resolveTransitFareMap(journey, segments)
  const legs = []
  let nextChainStart = chainStart ? parseOrderDateTime(chainStart) : null

  segments.forEach((segment, index) => {
    const amount_paise = inrToPaise(fareBySegmentId.get(segment.id))
    if (amount_paise <= 0) return

    const stopCoords = resolveTransitStopCoords(journey, index, segments.length)
    const leg_info = buildTransitLegInfo(segment, trip, { metroBearerToken, stopCoords })
    if (!leg_info) return

    const times = resolveTransitLegTimes(segment, trip, nextChainStart)
    Object.assign(leg_info, times)
    nextChainStart = parseOrderDateTime(times.ExpectedEndTime)

    legs.push({
      leg_type: LEG_TYPE[segment.mode] || String(segment.mode || '').toUpperCase(),
      leg_info,
      amount_paise,
      payment_mode: PAYMENT_MODE,
    })
  })

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

  const invalidLeg = legs.find((leg) => {
    if (leg.payment_mode === PAYMENT_MODE_CASH) return false
    return !leg.amount_paise || leg.amount_paise <= 0
  })
  if (invalidLeg) {
    throw new Error(`Invalid fare for ${invalidLeg.leg_type} leg`)
  }

  const hasOnlineLeg = legs.some(
    (leg) => leg.payment_mode !== PAYMENT_MODE_CASH && leg.amount_paise > 0,
  )
  if (!hasOnlineLeg) {
    throw new Error('No online-payable legs for this order')
  }

  const pickupDrop = resolveOrderPickupDrop({ journey, trip })
  const missingPickupDrop = ['pickup_lat', 'pickup_lng', 'drop_lat', 'drop_lng'].filter(
    (key) => pickupDrop[key] == null,
  )
  if (missingPickupDrop.length) {
    throw new Error(`Missing order location fields: ${missingPickupDrop.join(', ')}`)
  }
  if (!pickupDrop.pickup_place_name || !pickupDrop.drop_place_name) {
    throw new Error('Missing pickup_place_name or drop_place_name')
  }

  let platform = String(getAppContext()?.src || '').trim()

  return compactRecord({
    user_id: resolveUserId(profile),
    name: profile.name || import.meta.env.VITE_ORDER_USER_NAME || 'Test User',
    mobile: profile.mobile || import.meta.env.VITE_ORDER_USER_MOBILE || '8755993810',
    email: profile.email || import.meta.env.VITE_ORDER_USER_EMAIL || 'test@example.com',
    platform: platform || undefined,
    ...pickupDrop,
    legs,
  })
}

/**
 * Last-mile Drop Service: CAB-only order from alighting station (M′) → destination B.
 * Creates a new order id (does not append to the parent transit order).
 */
export async function buildDropOrderPayload({ journey, trip, lastMile, selectedVehicle, user }) {
  const profile = user || getUserContext() || {}
  const dropLastMile = { ...lastMile, serviceId: 'drop' }

  if (!hasFirstMileLeg({ lastMile: dropLastMile, selectedVehicle })) {
    throw new Error('Select a ride option with a valid fare')
  }

  const payAtPickup = isPayAtPickupVehicle(selectedVehicle)
  const amount_paise = payAtPickup ? 0 : inrToPaise(selectedVehicle.fareInr ?? dropLastMile.fareInr)
  const leg_info = buildCabLegInfo({ journey, trip, lastMile: dropLastMile })

  if (
    [leg_info.pickup_lat, leg_info.pickup_lng, leg_info.drop_lat, leg_info.drop_lng].some(
      (value) => value == null,
    )
  ) {
    throw new Error('Drop service pickup/drop coordinates are missing')
  }

  const cabTimes = await resolveCabLegTimes({
    journey,
    trip,
    lastMile: dropLastMile,
    selectedVehicle,
  })
  Object.assign(leg_info, cabTimes)

  const leg = {
    leg_type: 'CAB',
    leg_info,
    amount_paise,
    payment_mode: payAtPickup ? PAYMENT_MODE_CASH : PAYMENT_MODE,
  }

  const agg_specific_info = buildCabAggSpecificInfo({
    lastMile: dropLastMile,
    selectedVehicle,
  })
  if (agg_specific_info && Object.keys(agg_specific_info).length) {
    leg.agg_specific_info = agg_specific_info
  }

  const pickupDrop = {
    pickup_lat: leg_info.pickup_lat,
    pickup_lng: leg_info.pickup_lng,
    pickup_place_name: stringId(leg_info.FromLocName) || undefined,
    drop_lat: leg_info.drop_lat,
    drop_lng: leg_info.drop_lng,
    drop_place_name: stringId(leg_info.ToLocName) || undefined,
  }

  if (!pickupDrop.pickup_place_name || !pickupDrop.drop_place_name) {
    throw new Error('Missing pickup_place_name or drop_place_name for drop order')
  }

  let platform = String(getAppContext()?.src || '').trim()

  return compactRecord({
    user_id: resolveUserId(profile),
    name: profile.name || import.meta.env.VITE_ORDER_USER_NAME || 'Test User',
    mobile: profile.mobile || import.meta.env.VITE_ORDER_USER_MOBILE || '8755993810',
    email: profile.email || import.meta.env.VITE_ORDER_USER_EMAIL || 'test@example.com',
    platform: platform || undefined,
    ...pickupDrop,
    legs: [leg],
  })
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

/** POST /api/orders/{orderId}/legs/{legId}/cancel — CAB (Refex) only today. */
export function orderLegCancelUrl(orderId, legId) {
  const id = getOrderId({ order_id: orderId, orderId }) ?? orderId
  if (!urls.orders || !id || legId == null || legId === '') return ''
  return `${urls.orders}/${encodeURIComponent(id)}/legs/${encodeURIComponent(String(legId))}/cancel`
}

/**
 * Cancel a confirmed order leg (CAB/Refex).
 * HTTP 200 is not enough — check `cancellation.status` (`CANCELLED` | `FAILED` | …).
 */
export async function cancelOrderLeg(
  orderId,
  legId,
  { cancelled_by = 'Customer', reason } = {},
  { signal } = {},
) {
  const url = orderLegCancelUrl(orderId, legId)
  if (!url) {
    throw new Error('Cancel URL is not configured (missing order id or leg id)')
  }

  const body = {
    cancelled_by: String(cancelled_by || 'Customer').trim() || 'Customer',
    reason: String(reason || '').trim() || 'Customer cancelled',
  }

  if (import.meta.env.DEV) {
    console.info('[orders] POST', url, { body })
  }

  const data = await PostRequest(url, body, {
    signal,
    headers: ordersAuthHeaders(),
  })

  const cancelStatus = String(data?.cancellation?.status || '').toUpperCase()
  if (cancelStatus === 'FAILED') {
    const err = new Error(
      data?.cancellation?.failure_reason || data?.leg?.failure_reason || 'Cancellation failed',
    )
    err.cancellation = data?.cancellation
    err.leg = data?.leg
    throw err
  }

  return data
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
const LEG_CANCELLED = new Set(['CANCELLED', 'CANCELED'])
const LEG_FAILED = new Set(['FAILED', 'FAILURE'])

export function classifyLegBooking(leg) {
  const status = String(leg?.status ?? '').toUpperCase()
  if (LEG_CONFIRMED.has(status)) return 'confirmed'
  if (LEG_CANCELLED.has(status)) return 'cancelled'
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
  const needsPg = (payload?.legs || []).some(
    (leg) => leg.payment_mode !== PAYMENT_MODE_CASH && Number(leg.amount_paise) > 0,
  )
  if (!needsPg) {
    return { ...order, pgInitiate: null, payAtPickupOnly: true }
  }
  const pgInitiate = await initiateOrderPg(getOrderId(order), { signal })
  return { ...order, pgInitiate }
}

export function userBookingsUrl(userId) {
  const id = resolveUserId({ userId })
  if (!ordersBaseUrl || id == null || id === '') return ''
  return `${ordersBaseUrl}/api/users/${encodeURIComponent(id)}/bookings`
}

/** GET /api/users/{user_id}/bookings — past orders for the signed-in user. */
export async function fetchUserBookings(userId, { signal } = {}) {
  const url = userBookingsUrl(userId)
  if (!url) throw new Error('Orders API URL is not configured')
  return ordersGet(url, { signal })
}
