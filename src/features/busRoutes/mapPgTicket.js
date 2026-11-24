/**
 * Map orders pg/status → livebus ticket view model.
 * Same API as journey success; different UI consumes this shape.
 */

function paiseToInr(paise) {
  const n = Number(paise)
  if (!Number.isFinite(n)) return 0
  return Math.round(n) / 100
}

function formatTicketDate(value) {
  if (!value) return ''
  const raw = String(value)
  const iso = raw.includes('T') ? raw : raw.replace(' ', 'T')
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    const display = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (display) return `${display[3]}-${display[2]}-${display[1]}`
    return raw
  }
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}

function routeCodeFromName(routeName) {
  const name = String(routeName || '')
  const match = name.match(/^([A-Za-z0-9]+)/)
  return match ? match[1] : name.slice(0, 8) || 'BUS'
}

function pickRtcBooking(pgStatus) {
  const bookings = Array.isArray(pgStatus?.bookings) ? pgStatus.bookings : []
  return (
    bookings.find((leg) => String(leg?.leg_type || '').toUpperCase() === 'RTC') ||
    bookings.find((leg) => leg?.booking_reference_number) ||
    bookings[0] ||
    null
  )
}

export function mapPgStatusToLiveBusTicket(pgStatus, { orderId } = {}) {
  const booking = pickRtcBooking(pgStatus)
  if (!booking) return null

  const details = booking.booking_details || {}
  const seats = Math.max(1, Number(booking.adult_count) || 0) + Math.max(0, Number(booking.child_count) || 0)
  const fareInr = paiseToInr(booking.amount_paise)
  const reference = booking.booking_reference_number || ''
  const routeName = details.route_name || ''
  const code = routeCodeFromName(routeName)
  const category = String(booking.service_category || details.service_category || 'BUS').trim()

  const resolvedOrderId = pgStatus?.order_id || orderId || ''
  return {
    orderId: resolvedOrderId,
    reference,
    date: formatTicketDate(
      details.paid_date_time ||
        booking.booking_confirmed_at ||
        details.journey_date ||
        booking.ExpectedStartTime,
    ),
    seats: seats || 1,
    passengerId: reference
      ? String(reference).slice(-6)
      : String(resolvedOrderId).replace(/\D/g, '').slice(-6) || '------',
    code,
    category,
    boardingStop:
      booking.from_stage_name ||
      booking.FromLocName ||
      details.from_stage_name ||
      details.from_stop_name ||
      details.FromLocName ||
      'Boarding',
    alightingStop:
      booking.to_stage_name ||
      booking.ToLocName ||
      details.to_stage_name ||
      details.to_stop_name ||
      details.ToLocName ||
      'Alighting',
    fareInr,
    validUntil: booking.ticket_expiry_time || booking.ExpectedEndTime || null,
    legStatus: booking.status || '',
    pgStatus: pgStatus?.pg_status || pgStatus?.pgStatus || null,
  }
}
