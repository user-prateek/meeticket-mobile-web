/**
 * Map Guide from pg/status.
 *
 * Place A = pickup_* | Place B = drop_*
 * M / M end = first/last METRO|RTC booking source_stop_* / destination_stop_*
 *
 * Example:
 *   A  Abids          pickup_lat/lng
 *   M  Nampally       bookings[RTC].source_stop_lat/lng
 *   M′ Telecom Nagar  bookings[RTC].destination_stop_lat/lng
 *   B  HITEC City     drop_lat/lng
 *
 * Routes: A→M (drive), M→M′ (transit), M′→B (drive)
 */

function readCoord(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function hasPoint(point) {
  return point && readCoord(point.lat) != null && readCoord(point.lng) != null
}

function geoPoint(lat, lng, label) {
  const la = readCoord(lat)
  const lo = readCoord(lng)
  if (la == null || lo == null) return null
  return { lat: la, lng: lo, label: String(label || '').trim() }
}

function placeLabel(...values) {
  for (const value of values) {
    const label = String(value || '').trim()
    if (label) return label
  }
  return ''
}

function bookingLegType(booking) {
  return String(booking?.leg_type || booking?.leg_type_code || '').toUpperCase()
}

function isTransitBooking(booking) {
  const type = bookingLegType(booking)
  return type === 'METRO' || type === 'RTC' || type === 'BUS'
}

function isCabBooking(booking) {
  return bookingLegType(booking) === 'CAB'
}

function bookingSeq(booking, index) {
  const n = Number(booking?.leg_sequence)
  return Number.isFinite(n) ? n : index
}

function details(booking) {
  return booking?.booking_details && typeof booking.booking_details === 'object'
    ? booking.booking_details
    : {}
}

/** Boarding stop of a METRO/RTC booking (M). */
function stopFrom(booking) {
  const d = details(booking)
  return geoPoint(
    booking?.source_stop_lat ?? booking?.source_station_lat,
    booking?.source_stop_lng ?? booking?.source_station_lng,
    placeLabel(
      booking?.FromLocName,
      booking?.from_station_name,
      d.from_stop_name,
      d.from_station_name,
    ),
  )
}

/** Alighting stop of a METRO/RTC booking (M end). */
function stopTo(booking) {
  const d = details(booking)
  return geoPoint(
    booking?.destination_stop_lat ?? booking?.destination_station_lat,
    booking?.destination_stop_lng ?? booking?.destination_station_lng,
    placeLabel(
      booking?.ToLocName,
      booking?.to_station_name,
      d.to_stop_name,
      d.to_station_name,
    ),
  )
}

function boardLabel(booking) {
  const d = details(booking)
  return placeLabel(
    booking?.FromLocName,
    booking?.from_station_name,
    d.from_stop_name,
    'Boarding station',
  )
}

function alightLabel(booking) {
  const d = details(booking)
  return placeLabel(
    booking?.ToLocName,
    booking?.to_station_name,
    d.to_stop_name,
    'Alighting station',
  )
}

/**
 * Build Map Guide options strictly from pg/status fields.
 * Returns null only when status has no usable location payload.
 */
export function buildMapGuideOptionsFromPgStatus(pgStatus) {
  if (!pgStatus || typeof pgStatus !== 'object') return null

  const hasPickupDrop =
    readCoord(pgStatus.pickup_lat) != null &&
    readCoord(pgStatus.pickup_lng) != null &&
    readCoord(pgStatus.drop_lat) != null &&
    readCoord(pgStatus.drop_lng) != null

  const bookings = Array.isArray(pgStatus.bookings)
    ? [...pgStatus.bookings]
        .map((booking, index) => ({ booking, index }))
        .sort((a, b) => bookingSeq(a.booking, a.index) - bookingSeq(b.booking, b.index))
        .map(({ booking }) => booking)
    : []

  const transit = bookings.filter(isTransitBooking)
  const firstTransit = transit[0] || null
  const lastTransit = transit[transit.length - 1] || null

  // Fallback: first CAB drop name as board label when transit names missing
  const firstCab = bookings.find(isCabBooking) || null

  if (!hasPickupDrop && !firstTransit) return null

  const pickupName = placeLabel(pgStatus.pickup_place_name, 'Your location')
  const dropName = placeLabel(pgStatus.drop_place_name, 'Destination')
  const mName = placeLabel(
    firstTransit ? boardLabel(firstTransit) : null,
    firstCab?.ToLocName,
    'Boarding station',
  )
  const mEndName = placeLabel(
    lastTransit ? alightLabel(lastTransit) : null,
    'Alighting station',
  )

  // A
  const pickup = geoPoint(pgStatus.pickup_lat, pgStatus.pickup_lng, pickupName)
  // B
  const drop = geoPoint(pgStatus.drop_lat, pgStatus.drop_lng, dropName)
  // M  — transit boarding stop coords (CAB legs have null stop coords)
  const board = firstTransit ? stopFrom(firstTransit) : null
  // M′ — transit alighting stop coords
  const alight = lastTransit ? stopTo(lastTransit) : null

  return [
    {
      id: 'first-mile',
      label: mName,
      travelMode: 'driving',
      from: pickup,
      to: board,
    },
    {
      id: 'transit',
      label: mEndName,
      travelMode: bookingLegType(firstTransit) === 'METRO' ? 'transit' : 'driving',
      from: board,
      to: alight,
    },
    {
      id: 'last-mile',
      label: dropName,
      travelMode: 'driving',
      from: alight,
      to: drop,
    },
  ]
}

function mileCoords(leg, raw) {
  const src = leg || {}
  const fallback = raw || {}
  return {
    fromLat: readCoord(src.fromLat ?? src.from_lat ?? fallback.fromLat ?? fallback.from_lat),
    fromLon: readCoord(
      src.fromLon ?? src.from_lon ?? src.fromLng ?? src.from_lng ?? fallback.fromLon ?? fallback.from_lon,
    ),
    toLat: readCoord(src.toLat ?? src.to_lat ?? fallback.toLat ?? fallback.to_lat),
    toLon: readCoord(
      src.toLon ?? src.to_lon ?? src.toLng ?? src.to_lng ?? fallback.toLon ?? fallback.to_lon,
    ),
  }
}

function buildMapGuideOptionsFromJourney({ journey, trip } = {}) {
  if (!journey && !trip) return null

  const access = journey?.access
  const egress = journey?.egress
  const accessRaw = journey?.raw?.access
  const egressRaw = journey?.raw?.egress
  const accessMile = mileCoords(access, accessRaw)
  const egressMile = mileCoords(egress, egressRaw)

  const pickupName = placeLabel(access?.fromLabel, trip?.fromPlace, 'Your location')
  const boardName = placeLabel(access?.toLabel, journey?.originStation, 'Boarding station')
  const alightName = placeLabel(egress?.fromLabel, journey?.destinationStation, 'Alighting station')
  const dropName = placeLabel(egress?.toLabel, trip?.toPlace, 'Destination')

  const pickup =
    geoPoint(accessMile.fromLat, accessMile.fromLon, pickupName) ||
    geoPoint(trip?.fromLat, trip?.fromLon ?? trip?.fromLng, pickupName)
  const board = geoPoint(accessMile.toLat, accessMile.toLon, boardName)
  const alight = geoPoint(egressMile.fromLat, egressMile.fromLon, alightName)
  const drop =
    geoPoint(egressMile.toLat, egressMile.toLon, dropName) ||
    geoPoint(trip?.toLat, trip?.toLon ?? trip?.toLng, dropName)

  return [
    { id: 'first-mile', label: boardName, travelMode: 'driving', from: pickup, to: board },
    { id: 'transit', label: alightName, travelMode: 'transit', from: board, to: alight },
    { id: 'last-mile', label: dropName, travelMode: 'driving', from: alight, to: drop },
  ]
}

/**
 * Prefers pg/status (order id → status after PG). Journey/trip only as fallback.
 */
export function buildMapGuideOptions({ journey, trip, booking, pgStatus } = {}) {
  const status = pgStatus || booking?.pgStatus || null
  return (
    buildMapGuideOptionsFromPgStatus(status) ||
    buildMapGuideOptionsFromJourney({ journey, trip }) ||
    []
  )
}

/** Google Maps directions — lat/lng only. */
export function openGoogleMapsDirections(option) {
  if (!option) return false
  const from = option.from
  const to = option.to
  if (!hasPoint(from) || !hasPoint(to)) return false

  const mode = option.travelMode || 'driving'
  const params = new URLSearchParams({
    api: '1',
    origin: `${from.lat},${from.lng}`,
    destination: `${to.lat},${to.lng}`,
    travelmode: mode,
  })

  window.open(`https://www.google.com/maps/dir/?${params.toString()}`, '_blank', 'noopener,noreferrer')
  return true
}
