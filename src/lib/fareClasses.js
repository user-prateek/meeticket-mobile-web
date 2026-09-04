function readPositiveInr(...values) {
  for (const value of values) {
    const amount = Number(value)
    if (Number.isFinite(amount) && amount > 0) return amount
  }
  return 0
}

export function formatFareClassLabel(option) {
  const categories = [
    ...new Set(
      (option?.routes || [])
        .map((route) => route?.service_category)
        .filter(Boolean),
    ),
  ]
  if (categories.length === 1) {
    return categories[0]
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }
  if (categories.length > 1) return categories.join(' / ')
  const fare = readPositiveInr(option?.fare)
  return fare ? `₹${fare}` : 'Fare option'
}

function pickRouteForLeg(routes, legRouteId) {
  if (!routes?.length) return null
  return (
    routes.find((route) => route.chalo_route_id === legRouteId || route.route_id === legRouteId) ||
    routes[0]
  )
}

/** One UI fare option per `fare_options` array entry from TGSRTC. */
export function mapLegFareOptions(leg) {
  const options = Array.isArray(leg?.fare_options) ? leg.fare_options : []
  const legRouteId = leg?.route_id

  return options
    .map((option, index) => {
      const fareInr = readPositiveInr(option?.fare)
      if (!fareInr) return null
      const routes = Array.isArray(option.routes) ? option.routes : []
      const matchedRoute = pickRouteForLeg(routes, legRouteId)

      return {
        id: `${legRouteId || 'leg'}-fare-${index}`,
        label: formatFareClassLabel(option),
        fareInr,
        routeId: matchedRoute?.chalo_route_id || matchedRoute?.route_id || legRouteId || null,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.fareInr - b.fareInr)
}

export function cheapestFareOptionId(options = []) {
  if (!options.length) return null
  return options.reduce(
    (best, option) => (!best || option.fareInr < best.fareInr ? option : best),
    null,
  )?.id
}

/** Default bus tier — match booked route when possible, else cheapest. */
export function defaultFareOptionId(routeId, options = []) {
  if (!options.length) return null
  const matched = options.find((option) => option.routeId && option.routeId === routeId)
  if (matched) return matched.id
  return cheapestFareOptionId(options)
}

export function formatSegmentFareRange(segment) {
  const options = segment?.fareOptions
  if (Array.isArray(options) && options.length > 1) {
    const fares = options.map((option) => Number(option.fareInr)).filter(Number.isFinite)
    if (!fares.length) return ''
    const min = Math.min(...fares)
    const max = Math.max(...fares)
    if (min === max) return `₹${min}`
    return `₹${min} - ${max}`
  }
  if (segment?.fareInr != null) return `₹${segment.fareInr}`
  return ''
}

export function buildInitialFareSelections(segments = []) {
  const selections = {}
  for (const segment of segments) {
    if (!segment?.fareOptions?.length) continue
    selections[segment.id] = defaultFareOptionId(segment.routeId, segment.fareOptions)
  }
  return selections
}

export function applyFareSelections(segments = [], selections = {}) {
  return segments.map((segment) => {
    if (!segment?.fareOptions?.length) return segment
    const optionId =
      selections[segment.id] ||
      defaultFareOptionId(segment.routeId, segment.fareOptions)
    const option =
      segment.fareOptions.find((item) => item.id === optionId) ||
      segment.fareOptions.reduce(
        (best, item) => (!best || item.fareInr < best.fareInr ? item : best),
        null,
      )
    if (!option) return segment
    return {
      ...segment,
      selectedFareOptionId: option.id,
      fareClassLabel: option.label,
      fareInr: option.fareInr,
      routeId: option.routeId || segment.routeId,
    }
  })
}

export function sumTransitFareInr(segments = []) {
  return segments
    .filter((segment) => segment.mode === 'bus' || segment.mode === 'metro')
    .reduce((sum, segment) => sum + (Number(segment.fareInr) || 0), 0)
}

export function sumBusFareInr(segments = []) {
  return segments
    .filter((segment) => segment.mode === 'bus')
    .reduce((sum, segment) => sum + (Number(segment.fareInr) || 0), 0)
}

export function applyFareSelectionsToJourney(journey, selections = {}) {
  if (!journey) return journey
  const segments = applyFareSelections(journey.segments || [], selections)
  const cardSegments = applyFareSelections(journey.cardSegments || segments, selections)
  // Bus total follows selected fare classes; metro uses API `metro.total_fare` (never sum legs).
  const busFareInr = sumBusFareInr(segments)
  const metroFareInr =
    journey.metroFareInr != null
      ? Number(journey.metroFareInr) || 0
      : readPositiveInrFromRawMetro(journey)
  const totalFareInr = busFareInr + metroFareInr
  return {
    ...journey,
    segments,
    cardSegments,
    busFareInr,
    metroFareInr,
    totalFareInr,
    payment: { ...(journey.payment || {}), amountInr: totalFareInr },
    fareSelections: selections,
  }
}

function readPositiveInrFromRawMetro(journey) {
  const amount = Number(journey?.raw?.metro?.total_fare)
  return Number.isFinite(amount) && amount > 0 ? amount : 0
}
