import { urls } from './config'
import { GetRequest } from './client'
import {
  LAST_MILE_OPTIONS,
  LAST_MILE_PROVIDERS,
  JOURNEY_SERVICES,
} from '../constants/journey'

const SHARED = {
  lastMileProviders: LAST_MILE_PROVIDERS,
  lastMileOptions: LAST_MILE_OPTIONS,
  services: JOURNEY_SERVICES,
}

const DEFAULTS = {
  accessMode: 'walk',
  egressMode: 'walk',
  candidates: 2,
}

export function tripCacheKey(trip) {
  return [
    trip.fromLat,
    trip.fromLon,
    trip.toLat,
    trip.toLon,
    trip.accessMode ?? DEFAULTS.accessMode,
    trip.egressMode ?? DEFAULTS.egressMode,
    trip.candidates ?? DEFAULTS.candidates,
  ].join('|')
}

function roundMeters(n) {
  return Math.round(Number(n) || 0)
}

function kmFromMeters(n) {
  return Math.round((Number(n) || 0) / 100) / 10
}

/**
 * Ensure metro station display names include "Metro Station".
 * e.g. "Ameerpet" → "Ameerpet Metro Station"
 */
export function formatMetroStationName(name) {
  if (name == null) return name
  const trimmed = String(name).trim()
  if (!trimmed) return trimmed
  if (/metro\s*station/i.test(trimmed)) {
    return trimmed.replace(/metro\s*station/i, 'Metro Station')
  }
  if (/\bmetro$/i.test(trimmed)) {
    return trimmed.replace(/\s*metro$/i, ' Metro Station')
  }
  return `${trimmed} Metro Station`
}

function stationName(name, mode) {
  if (mode !== 'metro') return name
  return formatMetroStationName(name)
}

function stationKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s*metro\s*station$/i, '')
    .replace(/\s+/g, ' ')
}

function isMetroEndpoint(name, metro) {
  if (!name || !metro?.stops?.length) return false
  const key = stationKey(name)
  return metro.stops.some(
    (stop) => stationKey(stop.from) === key || stationKey(stop.to) === key,
  )
}

function parseTimeToMinutes(value) {
  if (!value || typeof value !== 'string') return null
  const [h, m, s] = value.split(':').map(Number)
  if (![h, m].every(Number.isFinite)) return null
  return h * 60 + m + (Number.isFinite(s) ? s / 60 : 0)
}

function waitMinutes(arrival, depart) {
  const a = parseTimeToMinutes(arrival)
  const d = parseTimeToMinutes(depart)
  if (a == null || d == null) return null
  let diff = d - a
  if (diff < 0) diff += 24 * 60
  return Math.max(0, Math.round(diff))
}

function lineLabel(mode, leg) {
  const line = leg.route_id || leg.route_short_name || ''
  if (mode === 'metro') return line ? `Metro ${line}` : 'Metro'
  if (mode === 'bus') return line ? `Bus ${line}` : 'Bus TGSRTC'
  return line || mode
}

function mapMileLeg(block, { fromLabel, toLabel, role }) {
  if (!block) return null
  return {
    role,
    mode: block.mode || 'walk',
    distanceM: roundMeters(block.distance_m),
    durationMin: Math.round(Number(block.duration_minutes) || 0),
    fromLabel,
    toLabel,
    fromLat: block.from_lat,
    fromLon: block.from_lon,
    toLat: block.to_lat,
    toLon: block.to_lon,
  }
}

function mapTransitHops(block, mode, prefix) {
  const legs = Array.isArray(block?.legs) ? block.legs : []
  if (!legs.length) {
    return { hops: [], stops: [], fare: 0, durationMin: 0, direct: true, transferName: null }
  }

  const hops = []
  const stops = []

  legs.forEach((leg, index) => {
    if (index > 0) {
      const wait = waitMinutes(legs[index - 1].arrival_time, leg.depart_time)
      const transferName = stationName(
        block.transfer_station_name || legs[index - 1].to_station_name || leg.from_station_name,
        mode,
      )

      hops.push({
        id: `${prefix}-interchange-${index}`,
        mode: 'interchange',
        durationMin: wait ?? 0,
        title: 'Interchange',
        subtitle: 'Interchange',
        detailTitle: transferName ? `Interchange at ${transferName}` : 'Interchange',
        from: stationName(legs[index - 1].to_station_name, mode),
        to: stationName(leg.from_station_name, mode),
        transferName,
        stationId: block.transfer_station_id || legs[index - 1].to_station_id,
      })
    }

    const title = mode === 'metro' ? 'Metro' : 'Bus TGSRTC'
    const from = stationName(leg.from_station_name, mode)
    const to = stationName(leg.to_station_name, mode)

    hops.push({
      id: `${prefix}-${index}`,
      mode,
      durationMin: Math.round(Number(leg.duration_minutes) || 0),
      fareInr: leg.fare != null ? Number(leg.fare) : undefined,
      title,
      subtitle: title,
      detailTitle: lineLabel(mode, leg),
      from,
      to,
      fromId: leg.from_station_id,
      toId: leg.to_station_id,
      routeId: leg.route_id,
      routeShortName: leg.route_short_name,
      departTime: leg.depart_time,
      arrivalTime: leg.arrival_time,
      stopCount: 1,
    })

    stops.push({
      from,
      to,
      mode,
      routeId: leg.route_id,
    })
  })

  const fare =
    Number(block.total_fare) ||
    legs.reduce((sum, leg) => sum + (leg.fare != null ? Number(leg.fare) : 0), 0)
  const durationMin =
    Number(block.total_duration_minutes) ||
    hops.filter((h) => h.mode !== 'interchange').reduce((sum, h) => sum + (h.durationMin || 0), 0)

  const transitHops = hops.filter((h) => h.mode === mode)
  if (fare && transitHops.length && transitHops.every((h) => h.fareInr == null)) {
    transitHops[0].fareInr = fare
  }

  return {
    hops,
    stops,
    fare,
    durationMin: Math.round(durationMin),
    direct: Boolean(block.direct),
    transferName: stationName(block.transfer_station_name, mode) || null,
  }
}

function optionLabel(metro, bus) {
  const parts = []
  if (bus.stops.length) {
    parts.push(bus.direct && bus.stops.length === 1 ? 'Direct Bus' : 'Bus')
  }
  if (metro.stops.length) {
    parts.push(metro.direct && metro.stops.length === 1 ? 'Direct Metro' : 'Metro')
  }
  return parts.join(' + ') || 'Journey'
}

export function mapJourneyOption(item, index, trip) {
  const metro = mapTransitHops(item.metro, 'metro', 'seg-metro')
  const bus = mapTransitHops(item.bus, 'bus', 'seg-bus')

  const originRaw = item.origin_station_name || 'Origin station'
  const destRaw = item.destination_station_name || 'Destination station'
  const origin = isMetroEndpoint(originRaw, metro)
    ? formatMetroStationName(originRaw)
    : originRaw
  const dest = isMetroEndpoint(destRaw, metro)
    ? formatMetroStationName(destRaw)
    : destRaw

  const segments = [...bus.hops, ...metro.hops]
  const cardSegments = segments
  const stops = [...bus.stops, ...metro.stops]
  const fare = (bus.fare || 0) + (metro.fare || 0)
  const walkM = roundMeters(item.access?.distance_m) + roundMeters(item.egress?.distance_m)

  const access = mapMileLeg(item.access, {
    role: 'access',
    fromLabel: trip.fromPlace || 'Pickup',
    toLabel: origin,
  })
  const egress = mapMileLeg(item.egress, {
    role: 'egress',
    fromLabel: dest,
    toLabel: trip.toPlace || 'Drop',
  })

  const notSuggested = Boolean(item.not_suggested)

  return {
    id: index + 1,
    label: optionLabel(metro, bus),
    raw: item,
    ...SHARED,
    segments,
    cardSegments,
    stops,
    access,
    egress,
    payment: { method: 'Cash', amountInr: fare },
    // totalDistanceKm: kmFromMeters(walkM),
    totalDistanceKm: '--',
    totalTimeMin: Math.round(Number(item.metro.total_duration_minutes) || 0),
    totalFareInr: fare,
    notSuggested,
    note:
      item.note ||
      (notSuggested ? 'Metro not suggested — this trip may be short enough to walk.' : null),
    originStation: origin,
    destinationStation: dest,
  }
}

export function buildJourneyParams(trip) {
  return {
    from_lat: trip.fromLat,
    from_lon: trip.fromLon,
    to_lat: trip.toLat,
    to_lon: trip.toLon,
    access_mode: trip.accessMode ?? DEFAULTS.accessMode,
    egress_mode: trip.egressMode ?? DEFAULTS.egressMode,
    candidates: trip.candidates ?? DEFAULTS.candidates,
  }
}

/** GET journey options — returns { data: raw[], options: mapped[] } */
export async function fetchJourneyOptions(trip, { signal } = {}) {
  if (trip.fromLat == null || trip.fromLon == null || trip.toLat == null || trip.toLon == null) {
    throw new Error('from_lat, from_lon, to_lat and to_lon are required')
  }

  const data = await GetRequest(urls.journey, buildJourneyParams(trip), { signal })

  const list = Array.isArray(data) ? data : data?.data ?? data?.journeys ?? []
  const options = list.map((item, index) => mapJourneyOption(item, index, trip))

  return { data: list, options }
}
