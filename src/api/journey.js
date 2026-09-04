import { urls } from './config'
import { GetRequest } from './client'
import {
  LAST_MILE_OPTIONS,
  LAST_MILE_PROVIDERS,
  JOURNEY_SERVICES,
} from '../constants/journey'
import { defaultFareOptionId, mapLegFareOptions } from '../lib/fareClasses'
import { takeJourneySourcePrefetches } from '../lib/journeyPrefetch'

const SHARED = {
  lastMileProviders: LAST_MILE_PROVIDERS,
  lastMileOptions: LAST_MILE_OPTIONS,
  services: JOURNEY_SERVICES,
}

const DEFAULTS = {
  accessMode: 'walk',
  egressMode: 'walk',
  candidates: 2,
  tgsrtcCandidates: 2,
}

/** Journey engines fetched in parallel; results merged in this order. */
const JOURNEY_SOURCES = [
  { id: 'metro', urlKey: 'journey', candidates: (trip) => trip.candidates ?? DEFAULTS.candidates },
  {
    id: 'tgsrtc',
    urlKey: 'tgsrtcJourney',
    candidates: (trip) => trip.tgsrtcCandidates ?? DEFAULTS.tgsrtcCandidates,
  },
]

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

/** Return metro station label as provided by API (no suffix normalization). */
export function formatMetroStationName(name) {
  if (name == null) return name
  return String(name).trim()
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
  if (mode === 'bus') return line ? `Bus ${line}` : 'TGSRTC Bus'
  return line || mode
}

function buildCardSegments(metro, bus) {
  const segments = []

  if (metro.hops.length) segments.push(...metro.hops)

  const hasMetroTransit = metro.hops.some((hop) => hop.mode === 'metro')
  const hasBusTransit = bus.hops.some((hop) => hop.mode === 'bus')
  if (hasMetroTransit && hasBusTransit) {
    const lastMetroHop = [...metro.hops].reverse().find((hop) => hop.mode === 'metro')
    const firstBusHop = bus.hops.find((hop) => hop.mode === 'bus')
    segments.push({
      id: `walk-${lastMetroHop?.id || 'metro'}-${firstBusHop?.id || 'bus'}`,
      mode: 'walk',
      durationMin: 5,
      title: 'Walk',
      subtitle: 'Walk',
      from: lastMetroHop?.to,
      to: firstBusHop?.from,
    })
  }

  if (bus.hops.length) segments.push(...bus.hops)
  return segments.length ? segments : [...bus.hops, ...metro.hops]
}

function readPositiveInr(...values) {
  for (const value of values) {
    const amount = Number(value)
    if (Number.isFinite(amount) && amount > 0) return amount
  }
  return 0
}

function legFareFromOptions(leg) {
  const options = mapLegFareOptions(leg)
  if (!options.length) return 0
  const optionId = defaultFareOptionId(leg?.route_id, options)
  const selected = options.find((option) => option.id === optionId) || options[0]
  return selected?.fareInr || 0
}

function legFareInr(leg) {
  const amount = readPositiveInr(
    leg?.fare,
    leg?.fare_inr,
    leg?.ticket_fare,
    leg?.amount,
    leg?.price,
  )
  if (amount > 0) return amount

  const fromOptions = legFareFromOptions(leg)
  return fromOptions > 0 ? fromOptions : undefined
}

function blockFareInr(block, mode) {
  // Metro: charge API `total_fare` only — never derive from leg `fare` fields.
  if (mode === 'metro') {
    return readPositiveInr(block?.total_fare)
  }
  return readPositiveInr(
    block?.total_fare,
    block?.fare,
    block?.ticket_fare,
    block?.amount,
    block?.price,
  )
}

function readCoord(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** First/last mile from journey API `access` / `egress` (user ↔ station lat/lng). */
function mapMileLeg(block, { fromLabel, toLabel, role }) {
  if (!block) return null
  return {
    role,
    mode: block.mode || 'walk',
    distanceM: roundMeters(block.distance_m),
    durationMin: Math.round(Number(block.duration_minutes) || 0),
    fromLabel,
    toLabel,
    fromLat: readCoord(block.from_lat),
    fromLon: readCoord(block.from_lon),
    toLat: readCoord(block.to_lat),
    toLon: readCoord(block.to_lon),
  }
}

function mapTransitHops(block, mode, prefix) {
  const legs = Array.isArray(block?.legs) ? block.legs : []
  if (!legs.length) {
    return { hops: [], stops: [], fare: 0, durationMin: 0, direct: true, transferName: null }
  }

  const hops = []
  const stops = []
  // Metro journey fare is `metro.total_fare` from API — never sum leg fares.
  const apiBlockFare = blockFareInr(block, mode)

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

    const title = mode === 'metro' ? 'Metro' : 'TGSRTC'
    const from = stationName(leg.from_station_name, mode)
    const to = stationName(leg.to_station_name, mode)

    const fareOptions = mapLegFareOptions(leg)
    const selectedFareOptionId = defaultFareOptionId(leg.route_id, fareOptions)
    const selectedFareOption =
      fareOptions.find((option) => option.id === selectedFareOptionId) || fareOptions[0]

    // Multi-leg metro: omit per-leg fare (API total only). Single metro can show leg/total.
    const hopFareInr =
      mode === 'metro' && legs.length > 1
        ? undefined
        : selectedFareOption?.fareInr ?? legFareInr(leg)

    hops.push({
      id: `${prefix}-${index}`,
      mode,
      durationMin: Math.round(Number(leg.duration_minutes) || 0),
      fareInr: hopFareInr,
      fareOptions,
      selectedFareOptionId: selectedFareOption?.id || null,
      title,
      subtitle: title,
      detailTitle: lineLabel(mode, leg),
      from,
      to,
      fromId: leg.from_station_id || leg.from_stop_id,
      toId: leg.to_station_id || leg.to_stop_id,
      fromStationCode: leg.from_station_code || leg.source_station_code || null,
      toStationCode: leg.to_station_code || leg.destination_station_code || null,
      routeId: selectedFareOption?.routeId || leg.route_id,
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

  let fare = apiBlockFare
  if (mode !== 'metro' && !fare) {
    fare = legs.reduce((sum, leg) => sum + readPositiveInr(legFareInr(leg)), 0)
  } else if (mode === 'metro' && !fare && legs.length === 1) {
    // Direct metro without total_fare: fall back to the single leg amount.
    fare = readPositiveInr(legFareInr(legs[0]))
  }

  const durationMin =
    Number(block.total_duration_minutes) ||
    hops.filter((h) => h.mode !== 'interchange').reduce((sum, h) => sum + (h.durationMin || 0), 0)

  const transitHops = hops.filter((h) => h.mode === mode)
  if (mode === 'metro' && fare && transitHops.length === 1 && transitHops[0].fareInr == null) {
    transitHops[0].fareInr = fare
  } else if (
    mode !== 'metro' &&
    fare &&
    transitHops.length &&
    transitHops.every((h) => h.fareInr == null)
  ) {
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

function notSuggestedHint(metro, bus) {
  const hasBus = bus.stops.length > 0 || bus.hops.length > 0
  const hasMetro = metro.stops.length > 0 || metro.hops.length > 0

  if (hasBus && !hasMetro) {
    return 'Not suggested — short enough to walk instead of bus.'
  }
  if (hasMetro && !hasBus) {
    return 'Not suggested — short enough to walk instead of metro.'
  }
  if (hasMetro && hasBus) {
    return 'Not suggested — short enough to walk instead of public transit.'
  }
  return 'Not suggested — this trip may be short enough to walk.'
}

function normalizeJourneyList(data) {
  return Array.isArray(data) ? data : data?.data ?? data?.journeys ?? []
}

/** TGSRTC engine returns top-level `legs` + `*_stop_*` fields; metro uses `bus`/`metro` blocks. */
function normalizeJourneyItem(item, source) {
  const hasTgsrtcShape =
    source === 'tgsrtc' ||
    (Array.isArray(item?.legs) && !item?.bus && !item?.metro)

  if (!hasTgsrtcShape) return item

  const legs = (item.legs || []).map((leg) => {
    const normalized = {
      ...leg,
      from_station_name: leg.from_station_name || leg.from_stop_name,
      to_station_name: leg.to_station_name || leg.to_stop_name,
      from_station_id: leg.from_station_id || leg.from_stop_id,
      to_station_id: leg.to_station_id || leg.to_stop_id,
      route_short_name: leg.route_short_name || leg.route_name,
    }
    const fare = legFareInr(normalized)
    return fare != null ? { ...normalized, fare } : normalized
  })

  const legFareSum = legs.reduce((sum, leg) => sum + readPositiveInr(legFareInr(leg)), 0)

  return {
    ...item,
    origin_station_name: item.origin_station_name || item.origin_stop_name,
    destination_station_name: item.destination_station_name || item.destination_stop_name,
    bus: {
      legs,
      direct: item.direct,
      transfer_station_name: item.transfer_stop_name || item.transfer_station_name,
      transfer_station_id: item.transfer_stop_id || item.transfer_station_id,
      total_duration_minutes: item.total_duration_minutes,
      total_fare:
        readPositiveInr(item.total_fare, item.fare, item.ticket_fare) || legFareSum || undefined,
    },
    metro: item.metro || { legs: [] },
  }
}

export function mapJourneyOption(item, trip, { id = 1, source } = {}) {
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
  const cardSegments = buildCardSegments(metro, bus)
  const stops = [...bus.stops, ...metro.stops]
  const metroFareInr = metro.fare || 0
  const busFareInr = bus.fare || 0
  const fare = busFareInr + metroFareInr
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
    id,
    source,
    label: optionLabel(metro, bus),
    raw: item,
    ...SHARED,
    segments,
    cardSegments,
    stops,
    access,
    egress,
    payment: { method: 'Online', amountInr: fare },
    // totalDistanceKm: kmFromMeters(walkM),
    totalDistanceKm: '--',
    totalTimeMin: Math.round(
      Number(item.metro?.total_duration_minutes) ||
        Number(item.bus?.total_duration_minutes) ||
        Number(item.total_duration_minutes) ||
        0,
    ),
    metroFareInr,
    busFareInr,
    totalFareInr: fare,
    notSuggested,
    note: item.note || (notSuggested ? notSuggestedHint(metro, bus) : null),
    originStation: origin,
    destinationStation: dest,
  }
}

export function buildJourneyParams(trip, { candidates } = {}) {
  return {
    from_lat: trip.fromLat,
    from_lon: trip.fromLon,
    to_lat: trip.toLat,
    to_lon: trip.toLon,
    access_mode: trip.accessMode ?? DEFAULTS.accessMode,
    egress_mode: trip.egressMode ?? DEFAULTS.egressMode,
    candidates: candidates ?? trip.candidates ?? DEFAULTS.candidates,
  }
}

function mergeJourneyChunks(bySource) {
  const data = []
  const options = []
  let id = 1

  for (const source of JOURNEY_SOURCES) {
    const chunk = bySource.get(source.id)
    if (!chunk) continue
    for (let index = 0; index < chunk.raw.length; index += 1) {
      data.push(chunk.raw[index])
      options.push(
        mapJourneyOption(chunk.raw[index], chunk.trip, {
          id: id++,
          source: source.id,
        }),
      )
    }
  }

  return { data, options }
}

async function fetchJourneySource(source, trip, { signal, bySource, onPartial, prefetches } = {}) {
  const url = urls[source.urlKey]
  if (!url) {
    console.warn(`[journey] ${source.id}: URL not configured (${source.urlKey})`)
    return { source: source.id, ok: false }
  }

  const params = buildJourneyParams(trip, { candidates: source.candidates(trip) })
  let payload

  const prefetchPromise = prefetches?.[source.id]
  if (prefetchPromise) {
    try {
      payload = await prefetchPromise
    } catch {
      payload = await GetRequest(url, params, { signal })
    }
  } else {
    payload = await GetRequest(url, params, { signal })
  }

  const list = normalizeJourneyList(payload).map((item) => normalizeJourneyItem(item, source.id))

  bySource.set(source.id, { raw: list, trip })
  const merged = mergeJourneyChunks(bySource)
  onPartial?.(merged)
  return { source: source.id, ok: true, count: list.length }
}

/**
 * GET journey options from all engines in parallel.
 * Calls `onPartial` each time a source responds so the UI can render early results.
 * Returns { data: raw[], options: mapped[] }.
 *
 * Reuses HTML boot prefetch when present (same trip key) so APIs run during JS download.
 */
export async function fetchJourneyOptions(trip, { signal, onPartial } = {}) {
  if (trip.fromLat == null || trip.fromLon == null || trip.toLat == null || trip.toLon == null) {
    throw new Error('from_lat, from_lon, to_lat and to_lon are required')
  }

  const bySource = new Map()
  const errors = []
  const prefetches = takeJourneySourcePrefetches(tripCacheKey(trip))

  await Promise.all(
    JOURNEY_SOURCES.map(async (source) => {
      try {
        return await fetchJourneySource(source, trip, { signal, bySource, onPartial, prefetches })
      } catch (error) {
        if (error?.name === 'AbortError') throw error
        console.warn(`[journey] ${source.id} failed`, error)
        errors.push({ source: source.id, error })
        return { source: source.id, ok: false, error }
      }
    }),
  )

  const merged = mergeJourneyChunks(bySource)
  if (merged.options.length === 0) {
    throw errors[0]?.error || new Error('Could not load journey options')
  }

  return merged
}
