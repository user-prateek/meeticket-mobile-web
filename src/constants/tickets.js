import olaBike from '../assets/vehicles/ola_bike.png'
import olaLogo from '../assets/brands/ola.png'
import rapidoLogo from '../assets/brands/rapido.png'
import refexLogo from '../assets/brands/refex.png'
import {
  classifyLegBooking,
  getOrderId,
  shouldContinuePgPolling,
} from '../api/orders'

const CAB_PROVIDER_LOGOS = {
  ola: olaLogo,
  rapido: rapidoLogo,
  refex: refexLogo,
}

export function getCabProviderLogo(providerId) {
  const key = String(providerId || '').toLowerCase()
  return CAB_PROVIDER_LOGOS[key] || null
}

const CAB_PROVIDER_ALIASES = {
  refex: 'refex',
  ola: 'ola',
  rapido: 'rapido',
}

/** pg/status `cab_aggregator` / provider fields → `ola` | `refex` | `rapido`. */
export function resolveCabProviderId(leg, details) {
  const raw =
    leg?.cab_aggregator ||
    leg?.cabAggregator ||
    details?.cab_aggregator ||
    details?.provider ||
    details?.provider_id ||
    details?.providerId ||
    ''
  const key = String(raw).trim().toLowerCase()
  if (!key) return null
  if (CAB_PROVIDER_ALIASES[key]) return CAB_PROVIDER_ALIASES[key]
  if (key.includes('refex')) return 'refex'
  if (key.includes('ola')) return 'ola'
  if (key.includes('rapido')) return 'rapido'
  return key.replace(/\s+/g, '')
}

export function readCabVerificationCode(leg, details) {
  const code =
    leg?.verification_code ||
    leg?.verificationCode ||
    details?.verification_code ||
    details?.verificationCode ||
    details?.pin ||
    ''
  return String(code || '').trim()
}

function readLegLocName(leg, role) {
  if (role === 'from') {
    return String(leg?.FromLocName || leg?.from_loc_name || leg?.fromLocName || '').trim()
  }
  return String(leg?.ToLocName || leg?.to_loc_name || leg?.toLocName || '').trim()
}

function readCabDriverInfo(leg, details) {
  const assignment = details?.driver_assignment
  const info =
    leg?.driver_info ||
    leg?.driverInfo ||
    details?.driver_info ||
    details?.driverInfo ||
    assignment?.chauffeur ||
    assignment?.driver
  return info && typeof info === 'object' ? info : null
}

function readCabVehicleInfo(leg, details) {
  const assignment = details?.driver_assignment
  const info =
    leg?.vehicle_info ||
    leg?.vehicleInfo ||
    details?.vehicle_info ||
    details?.vehicleInfo ||
    assignment?.vehicle
  return info && typeof info === 'object' ? info : null
}

function formatCabProviderTitle(providerId, aggregatorLabel) {
  const label = String(aggregatorLabel || '').trim()
  if (label) return label
  if (providerId === 'refex') return 'Refex'
  if (providerId === 'ola') return 'OLA'
  if (providerId === 'rapido') return 'Rapido'
  return 'Cab'
}

function formatCabTicketTitle(providerId, aggregatorLabel, vehicleType) {
  const provider = formatCabProviderTitle(providerId, aggregatorLabel)
  const type = String(vehicleType || '').trim()
  if (type && provider && type.toLowerCase() !== provider.toLowerCase()) {
    return `${provider} ${type}`
  }
  return type || provider || 'Cab'
}

function formatCabVehicleDescription(vehicleInfo) {
  if (!vehicleInfo) return ''
  const color = String(vehicleInfo.color || '').trim()
  const name = String(
    vehicleInfo.name || vehicleInfo.vehicle_model || vehicleInfo.model || '',
  ).trim()
  const type = String(vehicleInfo.vehicle_type || vehicleInfo.type || '').trim()
  const parts = []
  if (color) parts.push(color)
  if (name) parts.push(name)
  else if (type) parts.push(type)
  return parts.join(' ')
}

function durationMinFromExpectedTimes(leg) {
  const startRaw = leg?.ExpectedStartTime || leg?.expectedStartTime
  const endRaw = leg?.ExpectedEndTime || leg?.expectedEndTime
  if (!startRaw || !endRaw) return null
  const start = new Date(String(startRaw).replace(' ', 'T'))
  const end = new Date(String(endRaw).replace(' ', 'T'))
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  const minutes = Math.ceil((end.getTime() - start.getTime()) / 60000)
  return minutes > 0 ? minutes : null
}

function cabDatetimeFromLeg(leg, details, fallback) {
  const expected = leg?.ExpectedStartTime || leg?.expectedStartTime
  if (expected) {
    const formatted = formatBookingTimestamp(expected)
    if (formatted) return formatted
  }
  return issuedOnFromLeg(leg, details, fallback)
}

export const CANCEL_REASONS = [
  { id: 'wait', label: 'Wait time was too long' },
  { id: 'helmet', label: 'No helmet provided' },
  { id: 'find-driver', label: 'Could not find driver' },
  { id: 'not-closer', label: 'Driver not getting closer' },
  { id: 'asked-cancel', label: 'Driver asked me to cancel or ride off app' },
  { id: 'other', label: 'Other' },
]

export const PRIMARY_TICKET_TABS = [
  { id: 'metro', label: 'Metro', mode: 'metro' },
  { id: 'bus', label: 'TGSRTC', mode: 'bus' },
  { id: 'cab', label: 'Cab', mode: 'cab' },
  { id: 'other', label: 'Other', mode: 'other' },
]

/** pg/status `bookings[].leg_type` → primary tab id. */
export const LEG_TYPE_TO_TAB = {
  METRO: 'metro',
  RTC: 'bus',
  CAB: 'cab',
  AUTO: 'cab',
  BIKE: 'cab',
}

/** Map API leg_type to ticket tab + UI renderer. */
export function legTypeToTabId(legType) {
  const code = String(legType || '').toUpperCase()
  return LEG_TYPE_TO_TAB[code] || 'other'
}

function emptyTicketsByTab() {
  return {
    metro: { journeys: [] },
    bus: { journeys: [] },
    cab: { journeys: [] },
    other: { journeys: [] },
  }
}

export function getTabJourneys(booking, tabId) {
  return booking?.tickets?.[tabId]?.journeys ?? []
}

export function isTabEnabled(booking, tabId) {
  return getTabJourneys(booking, tabId).length > 0
}

function tabHasJourneys(tickets, tabId) {
  return (tickets?.[tabId]?.journeys?.length ?? 0) > 0
}

/**
 * Default success tab: cab when booked, else first pg/status leg in API order.
 */
export function resolveDefaultTabFromBookings(bookings = [], tickets) {
  if (!Array.isArray(bookings) || !bookings.length) {
    return PRIMARY_TICKET_TABS.find((tab) => tabHasJourneys(tickets, tab.id))?.id ?? 'metro'
  }

  const hasCab = bookings.some((leg) => legTypeToTabId(leg.leg_type) === 'cab')
  if (hasCab && tabHasJourneys(tickets, 'cab')) return 'cab'

  for (const leg of bookings) {
    const tabId = legTypeToTabId(leg.leg_type)
    if (tabHasJourneys(tickets, tabId)) return tabId
  }

  return PRIMARY_TICKET_TABS.find((tab) => tabHasJourneys(tickets, tab.id))?.id ?? 'metro'
}

/**
 * Each primary tab holds 0–N journey tickets from pg/status bookings.
 * Bookings are bucketed by `leg_type` (RTC → TGSRTC, METRO → Metro, CAB → Cab).
 * Secondary Journey 1 / Journey 2 tabs render when a tab has 2+ legs of the same type.
 *
 * @typedef {{ journeys: object[] }} TabTickets
 */

/** Back-compat: flatten legacy single-ticket shape into { journeys: [ticket] }. */
export function normalizeBooking(booking) {
  if (!booking) return null

  const tickets = {}
  for (const tab of PRIMARY_TICKET_TABS) {
    const raw = booking.tickets?.[tab.id]
    if (Array.isArray(raw?.journeys)) {
      tickets[tab.id] = { journeys: raw.journeys }
    } else if (raw && typeof raw === 'object') {
      tickets[tab.id] = { journeys: [raw] }
    } else {
      tickets[tab.id] = { journeys: [] }
    }
  }

  return { ...booking, tabs: PRIMARY_TICKET_TABS, tickets }
}

function createMetroTicket(stop, index, journey, trip) {
  const metroSeg = journey?.segments?.find((s) => s.mode === 'metro')
  return {
    id: `metro-j${index + 1}`,
    type: 'metro',
    journeyLabel: `Journey ${index + 1}`,
    refId: '',
    fareInr: stop?.fareInr ?? metroSeg?.fareInr ?? 0,
    datetime: '',
    pax: 1,
    platformNo: null,
    tripType: 'ONEWAY',
    from: stop?.from ?? journey?.originStation ?? '',
    to: stop?.to ?? journey?.destinationStation ?? '',
    validTill: '',
    qrPayload: '',
    qrHint: 'Scan this QR at Metro Entry & Exit points',
  }
}

function createBusTicket(stop, index, journey) {
  const busSeg = journey?.segments?.find((s) => s.mode === 'bus')
  return {
    id: `bus-j${index + 1}`,
    type: 'bus',
    journeyLabel: `Journey ${index + 1}`,
    pnr: '',
    fareInr: stop?.fareInr ?? busSeg?.fareInr ?? 0,
    issuedOn: '',
    passengers: { adult: 1, child: 0 },
    from: stop?.from ?? '',
    to: stop?.to ?? '',
    validSeconds: 0,
    qrPayload: '',
    status: 'Valid',
    instruction: 'Show this QR code at the entry gate/ validator for a smooth journey.',
    terms:
      'This ticket is non-cancellable and non-refundable once the booking is successfully confirmed. Passengers are advised to carefully verify the route, boarding point, destination, travel details, passenger count and fare before completing the payment.',
  }
}

function createCabTicket({ journey, trip, index = 0 }) {
  const mile = journey?.access
  return {
    id: `cab-j${index + 1}`,
    type: 'cab',
    journeyLabel: `Journey ${index + 1}`,
    providerId: null,
    title: 'Cab',
    fareInr: 0,
    pin: '',
    datetime: '',
    pax: 1,
    durationMin: mile?.durationMin ?? null,
    from: trip?.fromPlace ?? mile?.fromLabel ?? '',
    to: mile?.toLabel ?? journey?.destinationStation ?? '',
    fromRole: 'Boarding',
    toRole: 'Alighting',
    paymentMethod: 'Cash',
    driver: {
      name: '',
      photoInitials: '?',
      rating: null,
      vehicleNo: '',
      vehicleModel: '',
      vehicleImage: olaBike,
    },
    tripDetails: '',
    canCancel: true,
  }
}

function formatBookingTimestamp(isoLike) {
  if (!isoLike) return null
  const d = new Date(String(isoLike).replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return String(isoLike)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${String(d.getFullYear()).slice(-2)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function parseMetroExpiryTime(value) {
  if (value == null || value === '') return null
  const raw = String(value).trim()

  // Metro API: DDMMYYYYHHmmss — e.g. 02092026235959 → 2 Sep 2026, 23:59:59
  if (/^\d{14}$/.test(raw)) {
    const d = new Date(
      Number(raw.slice(4, 8)),
      Number(raw.slice(2, 4)) - 1,
      Number(raw.slice(0, 2)),
      Number(raw.slice(8, 10)),
      Number(raw.slice(10, 12)),
      Number(raw.slice(12, 14)),
    )
    return Number.isNaN(d.getTime()) ? null : d
  }

  if (/^\d{12}$/.test(raw)) {
    const d = new Date(
      Number(raw.slice(4, 8)),
      Number(raw.slice(2, 4)) - 1,
      Number(raw.slice(0, 2)),
      Number(raw.slice(8, 10)),
      Number(raw.slice(10, 12)),
      0,
    )
    return Number.isNaN(d.getTime()) ? null : d
  }

  const d = new Date(raw.replace(' ', 'T'))
  return Number.isNaN(d.getTime()) ? null : d
}

function formatMetroValidTill(value) {
  const d = parseMetroExpiryTime(value)
  if (!d) return value ? String(value).trim() : ''
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const pad = (n) => String(n).padStart(2, '0')
  let hours = d.getHours()
  const minutes = pad(d.getMinutes())
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  return `${pad(d.getDate())} ${months[d.getMonth()]} '${String(d.getFullYear()).slice(-2)}, ${hours}:${minutes} ${ampm}`
}


function readMetroRefId(leg) {
  return String(
    leg.ticket_id ||
      leg.booking_reference_number ||
      leg.ticket_id ||
      leg.leg_id ||
      '',
  ).trim()
}

function resolveMetroFareInr(leg, fareInr) {
  const fare = Number(leg.fare)
  if (Number.isFinite(fare) && fare > 0) return fare
  return fareInr
}

export function secondsUntilValidUntil(validUntil) {
  if (!validUntil) return null
  const end = new Date(String(validUntil).replace(' ', 'T'))
  if (Number.isNaN(end.getTime())) return null
  return Math.max(0, Math.floor((end.getTime() - Date.now()) / 1000))
}

function readBookingDetails(leg) {
  const details = leg?.booking_details
  return details && typeof details === 'object' ? details : null
}

function readOrderAmountInr(pgStatus) {
  const amount = Number(pgStatus?.amount ?? pgStatus?.pg_response?.body?.txnAmount)
  return Number.isFinite(amount) ? amount : null
}

function resolveLegFareInr(leg, pgStatus) {
  if (leg.amount_paise != null) {
    const fare = Number(leg.amount_paise) / 100
    if (Number.isFinite(fare) && fare > 0) return fare
  }
  const legs = Array.isArray(pgStatus?.bookings) ? pgStatus.bookings : []
  const orderAmount = readOrderAmountInr(pgStatus)
  if (orderAmount != null && legs.length === 1) return orderAmount
  return null
}

function issuedOnFromLeg(leg, details, fallback) {
  if (details?.booking_date_display) return String(details.booking_date_display)
  if (details?.paid_date_time) {
    const formatted = formatBookingTimestamp(details.paid_date_time)
    if (formatted) return formatted
  }
  return formatBookingTimestamp(leg.booking_confirmed_at) || fallback
}

function ticketBaseFields(leg, { index, tabId, pgStatus }) {
  const legType = String(leg.leg_type || '').toUpperCase()
  const ref = leg.booking_reference_number || leg.leg_id || `leg-${index}`
  const fareInr = resolveLegFareInr(leg, pgStatus)

  return {
    legType,
    legId: leg.leg_id,
    type: tabId,
    journeyLabel: `Journey ${index + 1}`,
    journeyIndex: index,
    refId: ref,
    bookingReferenceNumber: leg.booking_reference_number || null,
    fareInr,
    bookingDetails: readBookingDetails(leg),
    rawLeg: leg,
  }
}

function ticketFromPgLeg(leg, { journey, trip, index, tabId, pgStatus }) {
  const state = classifyLegBooking(leg)
  const base = ticketBaseFields(leg, { index, tabId, pgStatus })
  const ref = base.refId
  const fareInr = base.fareInr ?? 55

  if (state === 'pending') {
    return {
      ...base,
      id: `${tabId}-pending-${leg.leg_id}`,
      bookingState: 'pending',
      message: 'Confirming booking…',
      pending: true,
    }
  }

  if (state === 'failed') {
    return {
      ...base,
      id: `${tabId}-failed-${leg.leg_id}`,
      bookingState: 'failed',
      message: leg.failure_reason || 'Booking could not be completed.',
      pending: false,
    }
  }

  if (tabId === 'metro') {
    const details = base.bookingDetails
    const defaults = createMetroTicket(null, index, journey, trip)
    const bookingRef = leg.booking_reference_number || null
    const ticketQr = leg.ticket_qr || leg.ticketQr || details?.ticket_qr || null
    const ticketId = leg.ticket_id || leg.ticketId || details?.ticket_id || null
    const refId = readMetroRefId(leg) || ref
    const childCount = Number(leg.child_count ?? details?.child_count ?? 0) || 0
    const adultCount = leg.adult_count ?? details?.adult_count ?? defaults.pax
    const expectedDurationMin = durationMinFromExpectedTimes(leg)
    return {
      ...defaults,
      ...base,
      id: `metro-${leg.leg_id}`,
      bookingState: 'confirmed',
      fareInr: resolveMetroFareInr(leg, fareInr ?? defaults.fareInr),
      refId:leg.ticket_id || refId,
      from: leg.from_station_name || defaults.from,
      to: leg.to_station_name || defaults.to,
      fromRole: 'Boarding',
      toRole: 'Alighting',
      datetime: cabDatetimeFromLeg(leg, details, defaults.datetime),
      pax: adultCount + childCount || adultCount,
      adultCount,
      childCount,
      platformNo: leg.platform_no ?? leg.platformNo ?? details?.platform_no ?? defaults.platformNo,
      tripType: String(
        leg.ticket_type || leg.ticketType || details?.ticket_type || defaults.tripType,
      ).toUpperCase(),
      durationMin: expectedDurationMin ?? defaults.durationMin,
      validTill:
        formatMetroValidTill(
          leg.ticket_expiry_time || leg.ticketExpiryTime || details?.ticket_expiry_time,
        ) || defaults.validTill,
      ticketQr,
      bookingReferenceNumber: bookingRef || ticketId || null,
      qrPayload: ticketQr,
    }
  }

  if (tabId === 'bus') {
    const details = base.bookingDetails
    const defaults = createBusTicket(null, index, journey)
    const bookingRef = leg.booking_reference_number || null
    return {
      ...defaults,
      ...base,
      id: `bus-${leg.leg_id}`,
      bookingState: 'confirmed',
      pnr: bookingRef || defaults.pnr,
      fareInr: fareInr ?? defaults.fareInr,
      issuedOn: issuedOnFromLeg(leg, details, defaults.issuedOn),
      from: readLegLocName(leg, 'from') || details?.from_stop_name || defaults.from,
      to: readLegLocName(leg, 'to') || details?.to_stop_name || defaults.to,
      passengers: {
        adult: leg.adult_count ?? details?.adult_count ?? defaults.passengers.adult,
        child: leg.child_count ?? details?.child_count ?? defaults.passengers.child,
      },
      routeName: details?.route_name || null,
      journeyDate: details?.journey_date || null,
      bookingReferenceNumber: bookingRef,
      qrPayload: bookingRef ? `MT-BUS-${bookingRef}` : `MT-BUS-${ref}`,
    }
  }

  if (tabId === 'cab') {
    const details = base.bookingDetails
    const defaults = createCabTicket({ journey, trip, index })
    const bookingRef = leg.booking_reference_number || null
    const providerId = resolveCabProviderId(leg, details) || defaults.providerId
    const aggregatorLabel = leg.cab_aggregator || leg.cabAggregator || details?.cab_aggregator
    const verificationCode = readCabVerificationCode(leg, details)
    const driverInfo = readCabDriverInfo(leg, details)
    const vehicleInfo = readCabVehicleInfo(leg, details)
    const driverName =
      driverInfo?.name ||
      driverInfo?.driver_name ||
      driverInfo?.driverName ||
      details?.driver_name ||
      details?.driverName ||
      defaults.driver.name
    const driverInitials = driverName.trim().charAt(0).toUpperCase() || defaults.driver.photoInitials
    const paymentMode = String(
      leg.payment_mode || leg.paymentMode || details?.payment_mode || pgStatus?.payment_mode || '',
    ).toUpperCase()
    const vehicleNo =
      vehicleInfo?.vehicle_number ||
      vehicleInfo?.vehicle_no ||
      vehicleInfo?.number ||
      vehicleInfo?.registration_number ||
      details?.vehicle_number ||
      details?.vehicle_no ||
      defaults.driver.vehicleNo
    const vehicleType =
      vehicleInfo?.vehicle_type ||
      vehicleInfo?.type ||
      details?.vehicle_type ||
      details?.service_name ||
      ''
    const vehicleModel =
      formatCabVehicleDescription(vehicleInfo) ||
      details?.vehicle_model ||
      details?.vehicle_name ||
      defaults.driver.vehicleModel
    const expectedDurationMin = durationMinFromExpectedTimes(leg)
    const childCount = Number(leg.child_count ?? details?.child_count ?? 0) || 0
    const adultCount = leg.adult_count ?? details?.adult_count ?? defaults.pax
    return {
      ...defaults,
      ...base,
      id: `cab-${leg.leg_id}`,
      bookingState: 'confirmed',
      fareInr: fareInr ?? defaults.fareInr,
      datetime: cabDatetimeFromLeg(leg, details, defaults.datetime),
      pax: adultCount + childCount || adultCount,
      pin: verificationCode || defaults.pin,
      from:
        readLegLocName(leg, 'from') ||
        details?.pickup_address ||
        details?.from_stop_name ||
        defaults.from,
      to:
        readLegLocName(leg, 'to') ||
        details?.drop_address ||
        details?.to_stop_name ||
        defaults.to,
      durationMin:
        expectedDurationMin ??
        vehicleInfo?.duration_min ??
        driverInfo?.duration_min ??
        details?.duration_min ??
        details?.eta_min ??
        defaults.durationMin,
      providerId,
      title: formatCabTicketTitle(providerId, aggregatorLabel, vehicleType),
      paymentMethod: paymentMode === 'ONLINE' ? 'Online' : 'Cash',
      referenceNumber: bookingRef || leg.block_reference_number || defaults.referenceNumber,
      tripDetails:
        details?.pickup_instructions ||
        details?.trip_details ||
        details?.instructions ||
        (bookingRef ? `Booking ref: ${bookingRef}` : defaults.tripDetails),
      driver: {
        ...defaults.driver,
        name: driverName,
        photoInitials: driverInitials,
        rating: driverInfo?.rating || driverInfo?.driver_rating || details?.driver_rating || defaults.driver.rating,
        vehicleNo,
        vehicleModel,
        vehicleImage: vehicleInfo?.image || vehicleInfo?.image_url || defaults.driver.vehicleImage,
      },
    }
  }

  return {
    ...base,
    id: `other-${leg.leg_id}`,
    bookingState: 'confirmed',
    message: `${base.legType || leg.leg_type} booking confirmed.`,
  }
}

/** Sort pg/status bookings into primary tabs by leg_type. Preserves API order within each tab. */
export function groupPgBookingsByTab(bookings = [], { journey, trip, pgStatus } = {}) {
  const tickets = emptyTicketsByTab()
  const counters = { metro: 0, bus: 0, cab: 0, other: 0 }

  for (const leg of bookings) {
    const tabId = legTypeToTabId(leg.leg_type)
    const index = counters[tabId]
    counters[tabId] += 1
    tickets[tabId].journeys.push(
      ticketFromPgLeg(leg, { journey, trip, index, tabId, pgStatus }),
    )
  }

  return tickets
}

/** Build tickets UI from pg/status `bookings` while legs confirm in background. */
export function buildBookingFromPgStatus({ journey, trip, order, pgStatus }) {
  const legs = Array.isArray(pgStatus?.bookings) ? pgStatus.bookings : []
  const tickets = groupPgBookingsByTab(legs, { journey, trip, pgStatus })

  if (!legs.length) {
    return {
      id: getOrderId(order) || pgStatus?.order_id || 'booking-live',
      orderId: getOrderId(order) || pgStatus?.order_id,
      order: order || null,
      pgInitiate: order?.pgInitiate ?? null,
      pgStatus,
      isPolling: shouldContinuePgPolling(pgStatus),
      journeyId: journey?.id,
      defaultTab: 'metro',
      tabs: PRIMARY_TICKET_TABS,
      payment: { method: 'Online' },
      tickets: emptyTicketsByTab(),
    }
  }

  const defaultTab = resolveDefaultTabFromBookings(legs, tickets)

  return {
    id: getOrderId(order) || pgStatus?.order_id || 'booking-live',
    orderId: getOrderId(order) || pgStatus?.order_id,
    order: order || null,
    pgInitiate: order?.pgInitiate ?? null,
    pgStatus,
    isPolling: shouldContinuePgPolling(pgStatus),
    journeyId: journey?.id,
    defaultTab,
    tabs: PRIMARY_TICKET_TABS,
    payment: { method: 'Online' },
    tickets,
  }
}
