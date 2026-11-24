/** Project a point onto a polyline and derive local bearing for bus markers. */

function toRad(deg) {
  return (deg * Math.PI) / 180
}

function toDeg(rad) {
  return (rad * 180) / Math.PI
}

export function haversineM(a, b) {
  const r = 6371000
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function bearingDeg(from, to) {
  const φ1 = toRad(from.lat)
  const φ2 = toRad(to.lat)
  const Δλ = toRad(to.lng - from.lng)
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

function projectOnSegment(point, a, b) {
  const ax = a.lng
  const ay = a.lat
  const bx = b.lng
  const by = b.lat
  const px = point.lng
  const py = point.lat
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return { point: { lat: a.lat, lng: a.lng }, t: 0 }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
  return { point: { lat: ay + t * dy, lng: ax + t * dx }, t }
}

/**
 * Snap `point` to the nearest location on `path` and return local heading.
 * Heading is degrees clockwise from north (Leaflet/CSS rotate), always along
 * path order (a → b) so the bus faces the direction of travel.
 */
export function snapToRoute(point, path) {
  const pts = (path || [])
    .map((p) => ({ lat: Number(p?.lat), lng: Number(p?.lng) }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
  if (!point || pts.length === 0) return null
  if (pts.length === 1) {
    return { point: { lat: pts[0].lat, lng: pts[0].lng }, heading: 0, distanceM: haversineM(point, pts[0]) }
  }

  let best = null
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i]
    const b = pts[i + 1]
    const projected = projectOnSegment(point, a, b)
    const distanceM = haversineM(point, projected.point)
    if (!best || distanceM < best.distanceM) {
      // Near the end of a segment, use the next segment so heading stays forward.
      let headingFrom = a
      let headingTo = b
      if (projected.t > 0.92 && i + 2 < pts.length) {
        headingFrom = b
        headingTo = pts[i + 2]
      }
      best = {
        point: projected.point,
        heading: bearingDeg(headingFrom, headingTo),
        distanceM,
        index: i,
        t: projected.t,
      }
    }
  }
  return best
}
