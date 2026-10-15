/** Metres between two WGS84 points. */
export function haversineMeters(aLat, aLng, bLat, bLng) {
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const lat1 = toRad(aLat)
  const lat2 = toRad(bLat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * Project `user` onto segment A→B in local metres.
 * `t` is 0 at A and 1 at B.
 */
function projectSegment(user, a, b) {
  const lat0 = (((a.lat + b.lat) / 2) * Math.PI) / 180
  const mx = (lng) => lng * Math.cos(lat0) * 111320
  const my = (lat) => lat * 110540
  const ax = mx(a.lng)
  const ay = my(a.lat)
  const bx = mx(b.lng)
  const by = my(b.lat)
  const ux = mx(user.lng)
  const uy = my(user.lat)
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  if (len2 === 0) {
    return { t: 0, dist: Math.hypot(ux - ax, uy - ay) }
  }
  const raw = ((ux - ax) * dx + (uy - ay) * dy) / len2
  const t = Math.max(0, Math.min(1, raw))
  return { t, dist: Math.hypot(ux - (ax + t * dx), uy - (ay + t * dy)), raw }
}

function point(stop) {
  return {
    lat: Number(stop.stop_lat),
    lng: Number(stop.stop_lon),
  }
}

/**
 * Boarding stop along the route.
 * The nearest pin can be the stop ahead. If the rider is still before that pin,
 * the ticket starts at the previous stop. Equal distances keep the earlier stop.
 */
export function pickBoardingStop(stops, lat, lng) {
  if (!Array.isArray(stops) || !stops.length) return null
  if (lat == null || lng == null || lat === '' || lng === '') return stops[0]
  const userLat = Number(lat)
  const userLng = Number(lng)
  if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) return stops[0]
  if (stops.length === 1) return stops[0]

  let nearest = 0
  let nearestMeters = Infinity
  for (let i = 0; i < stops.length; i += 1) {
    const here = point(stops[i])
    if (!Number.isFinite(here.lat) || !Number.isFinite(here.lng)) continue
    const meters = haversineMeters(userLat, userLng, here.lat, here.lng)
    if (meters < nearestMeters - 8 || (Math.abs(meters - nearestMeters) <= 8 && i < nearest)) {
      nearest = i
      nearestMeters = meters
    }
  }

  // Last stop cannot be a boarding point — a destination has to follow it.
  if (nearest >= stops.length - 1) return stops[stops.length - 2]
  if (nearest === 0) return stops[0]

  const ahead = point(stops[nearest])
  const previous = point(stops[nearest - 1])
  const along = projectSegment({ lat: userLat, lng: userLng }, previous, ahead)

  // Standing on the nearest stop.
  if (nearestMeters <= 80) return stops[nearest]
  // Approaching that stop, including when it is the nearer pin.
  if (along.raw < 1.05) return stops[nearest - 1]
  return stops[nearest]
}
