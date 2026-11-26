import { formatDistance, titleLabel } from './mapBusRoutes'
import { haversineM } from './routeGeometry'

function pathMeters(stops, fromId, toId) {
  if (!stops?.length) return null
  const start = stops.findIndex((stop) => stop.id && stop.id === fromId)
  const end = stops.findIndex((stop) => stop.id && stop.id === toId)
  if (start < 0 || end < 0 || end <= start) return null
  let total = 0
  for (let i = start; i < end; i += 1) {
    total += haversineM(stops[i], stops[i + 1])
  }
  return total > 0 ? total : null
}

/**
 * Journey summary model from vehicle ETA + previous-page query selections.
 */
export function mapRouteCheckout(detail, query = {}) {
  const board = detail?.boardingStop || null
  const alight = detail?.alightingStop || null
  const sourceName = titleLabel(query.fromPlace) || 'Your location'
  const destName =
    titleLabel(query.toPlace) || titleLabel(detail?.toPlace) || 'Destination'
  const code = String(query.code || detail?.code || 'Bus').trim() || 'Bus'
  const category =
    titleLabel(query.category) || titleLabel(detail?.category) || 'Bus'
  const fareQuery = Number(query.fare)
  const fareInr =
    Number.isFinite(fareQuery) && fareQuery > 0
      ? Math.round(fareQuery)
      : detail?.fareInr ?? null

  const sourcePoint =
    query.fromLat != null && query.fromLon != null
      ? { lat: query.fromLat, lng: query.fromLon }
      : null
  const destPoint =
    query.toLat != null && query.toLon != null
      ? { lat: query.toLat, lng: query.toLon }
      : null

  const walkToBoardM =
    detail?.boardingDistanceM ??
    (sourcePoint && board ? haversineM(sourcePoint, board) : null)
  const busLegM =
    pathMeters(detail?.stops, board?.id, alight?.id) ??
    (board && alight ? haversineM(board, alight) : null)
  const walkToDestM = alight && destPoint ? haversineM(alight, destPoint) : null

  const fromPlace =
    titleLabel(query.fromPlace) || titleLabel(detail?.fromPlace) || sourceName
  const toPlace =
    titleLabel(query.toPlace) || titleLabel(detail?.toPlace) || destName

  return {
    routeId: String(query.routeId || detail?.routeId || ''),
    vehicleId: String(query.vehicleId || detail?.vehicleNo || ''),
    tripId: String(query.tripId || detail?.tripId || ''),
    code,
    category,
    fareInr,
    fromPlace,
    toPlace,
    boardingStop: board?.name || detail?.boardingName || '',
    alightingStop: alight?.name || detail?.alightingName || '',
    legs: [
      {
        id: 'source',
        kind: 'source',
        label: 'Current Source Location',
        name: sourceName,
      },
      {
        id: 'board',
        kind: 'board',
        label: 'Boarding Stop',
        name: board?.name || detail?.boardingName || 'Boarding stop',
        distance: formatDistance(walkToBoardM),
      },
      {
        id: 'alight',
        kind: 'alight',
        label: 'Alighting Stop',
        name: alight?.name || detail?.alightingName || 'Alighting stop',
        distance: formatDistance(busLegM),
      },
      {
        id: 'dest',
        kind: 'dest',
        label: 'Destination Location',
        name: destName,
        distance: formatDistance(walkToDestM),
      },
    ],
  }
}
