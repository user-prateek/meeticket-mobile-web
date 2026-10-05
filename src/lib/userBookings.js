function parseDateTime(value) {
  if (!value) return null
  const d = new Date(String(value).replace(' ', 'T'))
  return Number.isNaN(d.getTime()) ? null : d
}

function paiseToInr(paise) {
  const n = Number(paise)
  return Number.isFinite(n) ? Math.round(n / 100) : 0
}

function legMode(legType) {
  const type = String(legType || '').toUpperCase()
  if (type === 'METRO') return 'metro'
  if (type === 'RTC') return 'bus'
  if (type === 'CAB' || type === 'AUTO' || type === 'BIKE') return 'cab'
  return 'other'
}

function legCapsuleTitle(mode, leg) {
  if (mode === 'metro') return 'Metro'
  if (mode === 'bus') return 'TGSRTC'
  if (mode === 'cab') return leg?.cab_aggregator || 'Cab'
  return leg?.leg_type || 'Other'
}

function readLegFrom(leg) {
  const details = leg?.booking_details
  return (
    details?.from_stage_name ||
    leg?.from_stage_name ||
    leg?.from_station_name ||
    leg?.FromLocName ||
    details?.from_stop_name ||
    ''
  ).trim()
}

function readLegTo(leg) {
  const details = leg?.booking_details
  return (
    details?.to_stage_name ||
    leg?.to_stage_name ||
    leg?.to_station_name ||
    leg?.ToLocName ||
    details?.to_stop_name ||
    ''
  ).trim()
}

function durationMinFromLeg(leg) {
  const start = parseDateTime(leg?.ExpectedStartTime)
  const end = parseDateTime(leg?.ExpectedEndTime)
  if (start && end && end > start) {
    return Math.max(1, Math.round((end - start) / 60000))
  }
  return null
}

function gapMinutes(prevLeg, nextLeg) {
  const end = parseDateTime(prevLeg?.ExpectedEndTime)
  const start = parseDateTime(nextLeg?.ExpectedStartTime)
  if (end && start && start > end) {
    return Math.max(1, Math.round((start - end) / 60000))
  }
  return 5
}

function fareInrFromLeg(leg) {
  const fromPaise = paiseToInr(leg?.amount_paise)
  if (fromPaise > 0) return fromPaise
  const fare = Number(leg?.fare)
  return Number.isFinite(fare) && fare > 0 ? Math.round(fare) : 0
}

function readServiceCategory(leg) {
  return String(leg?.service_category || leg?.booking_details?.service_category || '').trim() || null
}

function inferLastMileMode(cabLeg) {
  const type = String(cabLeg?.vehicle_info?.vehicle_type || '').toLowerCase()
  if (type.includes('auto')) return 'auto'
  if (type.includes('bike')) return 'bike'
  return 'cab'
}

function cabVehicleLabel(cabLeg) {
  const type = cabLeg?.vehicle_info?.vehicle_type
  if (type) return type
  const mode = inferLastMileMode(cabLeg)
  if (mode === 'auto') return 'Auto'
  if (mode === 'bike') return 'Bike'
  return 'Cab'
}

function shortPlaceName(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  return text.split(',')[0].trim()
}

/** Temporary list filters — cab stays hidden; metro/TGSRTC flags stay off unless needed. */
export const HIDE_CAB_LEGS = true
export const HIDE_METRO = false
export const HIDE_TGSRTC = false

/** `/bookings?mode=all|metro|bus` — aliases: tgsrtc, rtc. Missing mode uses the flags above. */
export function parseBookingsListMode(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === 'all' || raw === 'multi' || raw === 'multimode' || raw === 'multimodel') return 'all'
  if (raw === 'metro') return 'metro'
  if (raw === 'bus' || raw === 'tgsrtc' || raw === 'rtc') return 'bus'
  return null
}

export function hidesFromBookingsMode(mode) {
  if (mode === 'all') return { cab: false, metro: false, tgsrtc: false }
  if (mode === 'metro') return { cab: true, metro: false, tgsrtc: true }
  if (mode === 'bus') return { cab: true, metro: true, tgsrtc: false }
  return undefined
}

function bookingListHides(overrides) {
  return {
    cab: HIDE_CAB_LEGS,
    metro: HIDE_METRO,
    tgsrtc: HIDE_TGSRTC,
    ...overrides,
  }
}

function isHiddenBookingLeg(leg, hides = bookingListHides()) {
  const type = String(leg?.leg_type || '').toUpperCase()
  if (hides.cab && (type === 'CAB' || type === 'AUTO' || type === 'BIKE')) return true
  if (hides.metro && type === 'METRO') return true
  if (hides.tgsrtc && (type === 'RTC' || type === 'BUS')) return true
  return false
}

function extractLegs(orderRow) {
  return Object.keys(orderRow || {})
    .filter((key) => /^\d+$/.test(key))
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => ({ ...orderRow[key], leg_index: Number(key) }))
}

function buildTimelineSegments(transitLegs) {
  const segments = []
  transitLegs.forEach((leg, index) => {
    if (index > 0) {
      segments.push({
        id: `walk-${index}`,
        mode: 'walk',
        durationMin: gapMinutes(transitLegs[index - 1], leg),
      })
    }
    const mode = legMode(leg.leg_type)
    segments.push({
      id: `seg-${leg.leg_index ?? index}`,
      mode,
      title: legCapsuleTitle(mode, leg),
      durationMin: durationMinFromLeg(leg) ?? 0,
      fareInr: fareInrFromLeg(leg),
      serviceCategory: readServiceCategory(leg),
    })
  })
  return segments
}

function buildStops(transitLegs) {
  return transitLegs.map((leg) => {
    const mode = legMode(leg.leg_type)
    return {
      mode,
      from: readLegFrom(leg) || '—',
      to: readLegTo(leg) || '—',
      routeName: leg?.booking_details?.route_name || null,
      routeId: leg?.booking_details?.route_id || leg?.route_id || leg?.booking_details?.route_short_name || null,
      serviceCategory: readServiceCategory(leg),
      fareInr: fareInrFromLeg(leg),
    }
  })
}

function totalTimeMin(legs) {
  const starts = legs.map((leg) => parseDateTime(leg.ExpectedStartTime)).filter(Boolean)
  const ends = legs.map((leg) => parseDateTime(leg.ExpectedEndTime)).filter(Boolean)
  if (starts.length && ends.length) {
    const start = starts.reduce((min, d) => (d < min ? d : min), starts[0])
    const end = ends.reduce((max, d) => (d > max ? d : max), ends[0])
    if (end > start) return Math.max(1, Math.round((end - start) / 60000))
  }
  return legs.reduce((sum, leg) => sum + (durationMinFromLeg(leg) ?? 0), 0) || null
}

/** Map one API order row → card model for BookingCard. */
export function normalizeBookingOrder(orderRow, hideOverrides) {
  const orderId = String(orderRow?.order_id || '').trim()
  if (!orderId) return null

  const hides = bookingListHides(hideOverrides)
  const allLegs = extractLegs(orderRow)
  const legs = allLegs.filter((leg) => !isHiddenBookingLeg(leg, hides))
  if (!legs.length) return null

  const cabLegs = legs.filter((leg) => legMode(leg.leg_type) === 'cab')
  const transitLegs = legs.filter((leg) => legMode(leg.leg_type) !== 'cab')
  const cabLeg = cabLegs[0] ?? null

  const timelineLegs =
    transitLegs.length > 0
      ? transitLegs
      : cabLeg
        ? [cabLeg]
        : legs

  const segments = buildTimelineSegments(timelineLegs)
  const stops = buildStops(transitLegs.length ? transitLegs : timelineLegs)

  const totalFareInr = legs.reduce((sum, leg) => sum + fareInrFromLeg(leg), 0)

  return {
    orderId,
    segments,
    stops,
    cabLeg,
    cabFrom: readLegFrom(cabLeg) || readLegFrom(legs[0]) || '',
    cabAggregator: cabLeg?.cab_aggregator || null,
    cabFareInr: cabLeg ? fareInrFromLeg(cabLeg) : null,
    cabDurationMin: cabLeg ? durationMinFromLeg(cabLeg) : null,
    lastMileMode: cabLeg ? inferLastMileMode(cabLeg) : null,
    cabVehicleLabel: cabLeg ? cabVehicleLabel(cabLeg) : null,
    pickupLabel: cabLeg ? shortPlaceName(readLegFrom(cabLeg)) : shortPlaceName(readLegFrom(legs[0])),
    totalFareInr,
    totalTimeMin: totalTimeMin(legs),
    bookedAt: legs.find((leg) => leg.booking_confirmed_at)?.booking_confirmed_at || null,
  }
}

/** Map GET /api/users/{id}/bookings response → card models. */
export function normalizeUserBookingsResponse(response, hideOverrides) {
  const rows = Array.isArray(response?.data) ? response.data : []
  return rows.map((row) => normalizeBookingOrder(row, hideOverrides)).filter(Boolean)
}
