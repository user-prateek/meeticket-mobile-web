import { loadGoogleMaps } from './googleMaps'

/** Demo endpoints — real Hyderabad coords (user ↔ Miyapur area). */
export const LIVE_TRACKING_DEMO = {
  pickup: { lat: 17.5169014, lng: 78.3428304, label: 'Pickup', address: 'Near start point' },
  dropoff: { lat: 17.4965452, lng: 78.3730262, label: 'Dropoff', address: 'Miyapur Metro' },
  durationMs: 75_000,
  tickMs: 250,
}

function toRad(d) {
  return (d * Math.PI) / 180
}

function toDeg(r) {
  return (r * 180) / Math.PI
}

/** Distance in meters between two WGS84 points. */
export function haversineMeters(a, b) {
  const R = 6371000
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

/** Heading in degrees (0 = north, clockwise) from A → B. */
export function bearingDegrees(a, b) {
  const φ1 = toRad(a.lat)
  const φ2 = toRad(b.lat)
  const Δλ = toRad(b.lng - a.lng)
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function interpolate(a, b, t) {
  return {
    lat: lerp(a.lat, b.lat, t),
    lng: lerp(a.lng, b.lng, t),
  }
}

function dedupePath(points) {
  const out = []
  for (const point of points) {
    const prev = out[out.length - 1]
    if (!prev || haversineMeters(prev, point) > 0.5) out.push(point)
  }
  return out
}

/** Flatten Directions result into an ordered lat/lng path. */
export function pathFromDirectionsResult(result) {
  const route = result?.routes?.[0]
  if (!route) return []

  const points = []
  for (const leg of route.legs || []) {
    for (const step of leg.steps || []) {
      const stepPath = step.path || []
      for (const p of stepPath) {
        points.push({
          lat: typeof p.lat === 'function' ? p.lat() : Number(p.lat),
          lng: typeof p.lng === 'function' ? p.lng() : Number(p.lng),
        })
      }
    }
  }

  if (!points.length && route.overview_path) {
    for (const p of route.overview_path) {
      points.push({
        lat: typeof p.lat === 'function' ? p.lat() : Number(p.lat),
        lng: typeof p.lng === 'function' ? p.lng() : Number(p.lng),
      })
    }
  }

  return dedupePath(points)
}

function buildProgressIndex(path) {
  const cum = [0]
  let total = 0
  for (let i = 1; i < path.length; i += 1) {
    total += haversineMeters(path[i - 1], path[i])
    cum.push(total)
  }
  return { cum, totalMeters: total }
}

function positionAtDistance(path, cum, distanceM) {
  if (!path.length) return null
  if (distanceM <= 0) {
    const next = path[1] || path[0]
    return {
      ...path[0],
      bearing: bearingDegrees(path[0], next),
      segmentIndex: 0,
    }
  }
  if (distanceM >= cum[cum.length - 1]) {
    const last = path[path.length - 1]
    const prev = path[path.length - 2] || last
    return {
      ...last,
      bearing: bearingDegrees(prev, last),
      segmentIndex: path.length - 2,
    }
  }

  let i = 1
  while (i < cum.length && cum[i] < distanceM) i += 1
  const d0 = cum[i - 1]
  const d1 = cum[i]
  const t = d1 === d0 ? 0 : (distanceM - d0) / (d1 - d0)
  const a = path[i - 1]
  const b = path[i]
  return {
    ...interpolate(a, b, t),
    bearing: bearingDegrees(a, b),
    segmentIndex: i - 1,
  }
}

/**
 * Fetch a driving route between two points (Google Directions).
 * Returns { path, totalMeters, durationSec, distanceText, durationText, raw }.
 */
export async function fetchTrackingRoute(origin, destination, { signal } = {}) {
  const gmaps = await loadGoogleMaps()
  const result = await new Promise((resolve, reject) => {
    const onAbort = () => {
      const err = new Error('Aborted')
      err.name = 'AbortError'
      reject(err)
    }
    if (signal) signal.addEventListener('abort', onAbort, { once: true })

    const service = new gmaps.DirectionsService()
    service.route(
      {
        origin,
        destination,
        travelMode: gmaps.TravelMode.DRIVING,
        provideRouteAlternatives: false,
      },
      (res, status) => {
        if (signal) signal.removeEventListener('abort', onAbort)
        if (status === 'OK' && res) {
          resolve(res)
          return
        }
        reject(new Error(`Directions failed (${status})`))
      },
    )
  })

  const path = pathFromDirectionsResult(result)
  const { cum, totalMeters } = buildProgressIndex(path)
  const leg = result.routes?.[0]?.legs?.[0]

  return {
    path,
    cum,
    totalMeters,
    durationSec: leg?.duration?.value ?? null,
    distanceText: leg?.distance?.text || '',
    durationText: leg?.duration?.text || '',
    bounds: result.routes?.[0]?.bounds || null,
    raw: result,
  }
}

/**
 * Simulated GPS stream along a precomputed path.
 * Swap this for a real GPS WebSocket/API later — same onUpdate shape.
 *
 * onUpdate({ lat, lng, bearing, progress, remainingMeters, etaMin, speedMps })
 */
export function startMockGpsAlongPath(
  { path, cum, totalMeters, durationMs = LIVE_TRACKING_DEMO.durationMs, tickMs = LIVE_TRACKING_DEMO.tickMs },
  { onUpdate, onComplete } = {},
) {
  if (!path?.length || !totalMeters) {
    throw new Error('Mock GPS needs a non-empty route path')
  }

  let startedAt = performance.now()
  let pausedAt = 0
  let pausedMs = 0
  let timer = null
  let stopped = false

  const speedMps = totalMeters / (durationMs / 1000)

  function tick() {
    if (stopped) return
    const elapsed = performance.now() - startedAt - pausedMs
    const progress = Math.min(1, elapsed / durationMs)
    const distanceM = progress * totalMeters
    const pos = positionAtDistance(path, cum, distanceM)
    const remainingMeters = Math.max(0, totalMeters - distanceM)
    const etaMin = Math.max(1, Math.ceil(remainingMeters / Math.max(speedMps, 0.1) / 60))

    onUpdate?.({
      lat: pos.lat,
      lng: pos.lng,
      bearing: pos.bearing,
      progress,
      remainingMeters,
      etaMin: progress >= 1 ? 0 : etaMin,
      speedMps,
      done: progress >= 1,
    })

    if (progress >= 1) {
      stop()
      onComplete?.()
    }
  }

  function start() {
    if (timer || stopped) return
    timer = window.setInterval(tick, tickMs)
    tick()
  }

  function stop() {
    stopped = true
    if (timer) window.clearInterval(timer)
    timer = null
  }

  function pause() {
    if (!timer || pausedAt) return
    window.clearInterval(timer)
    timer = null
    pausedAt = performance.now()
  }

  function resume() {
    if (!pausedAt || stopped) return
    pausedMs += performance.now() - pausedAt
    pausedAt = 0
    timer = window.setInterval(tick, tickMs)
  }

  start()

  return { start, stop, pause, resume }
}
