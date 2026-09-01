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

export function mapLegFareOptions(leg) {
  const options = Array.isArray(leg?.fare_options) ? leg.fare_options : []
  return options
    .map((option, index) => {
      const fareInr = readPositiveInr(option?.fare)
      if (!fareInr) return null
      const routes = Array.isArray(option.routes) ? option.routes : []
      const matchedRoute =
        routes.find(
          (route) => route.chalo_route_id === leg?.route_id || route.route_id === leg?.route_id,
        ) || routes[0]
      return {
        id: `${leg?.route_id || 'leg'}-fare-${index}`,
        label: formatFareClassLabel(option),
        fareInr,
        routeId: matchedRoute?.chalo_route_id || matchedRoute?.route_id || null,
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

/** Default bus tier for SRP/detail — always cheapest; user can change in fare picker. */
export function defaultFareOptionId(_routeId, options = []) {
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
    selections[segment.id] = cheapestFareOptionId(segment.fareOptions)
  }
  return selections
}

export function applyFareSelections(segments = [], selections = {}) {
  return segments.map((segment) => {
    if (!segment?.fareOptions?.length) return segment
    const optionId =
      selections[segment.id] ||
      cheapestFareOptionId(segment.fareOptions)
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

export function applyFareSelectionsToJourney(journey, selections = {}) {
  if (!journey) return journey
  const segments = applyFareSelections(journey.segments || [], selections)
  const cardSegments = applyFareSelections(journey.cardSegments || segments, selections)
  const totalFareInr = sumTransitFareInr(segments)
  return {
    ...journey,
    segments,
    cardSegments,
    totalFareInr,
    payment: { ...(journey.payment || {}), amountInr: totalFareInr },
    fareSelections: selections,
  }
}
