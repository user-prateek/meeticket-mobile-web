import { tgsrtcBaseUrl } from '../../api/config'
import { GetRequest } from '../../api/client'
import { sampleFare } from './sampleStops'

function mapStopsPayload(data, vehicleId) {
  const stops = Array.isArray(data?.stops) ? data.stops : []
  if (!stops.length) throw new Error('This bus has no stops')
  return {
    vehicleId: data.vehicle_id || vehicleId,
    tripId: data.trip_id || stops[0]?.trip_id || '',
    chaloRouteId: data.chalo_route_id || '',
    routeName: data.route_name || '',
    serviceCategory: data.service_category || '',
    stops,
  }
}

function useSampleFare() {
  return {
    fare: sampleFare.fare,
    fromStopId: sampleFare.from_stop_id,
    toStopId: sampleFare.to_stop_id,
    chaloRouteId: sampleFare.chalo_route_id,
    serviceCategory: sampleFare.service_category,
  }
}

export function readBusTicketQuery(params) {
  const read = (...keys) => {
    for (const key of keys) {
      const value = params.get(key)
      if (value != null && String(value).trim() !== '') return String(value).trim()
    }
    return ''
  }
  const num = (...keys) => {
    const raw = read(...keys)
    if (!raw) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }
  return {
    vehicleId: read('vehicle_id', 'bus_id', 'vehicle', 'bus', 'vehicleid', 'busid'),
    lat: num('lat', 'latitude', 'user_lat', 'pickup_lat'),
    lng: num('lng', 'lon', 'long', 'longitude', 'user_lng', 'user_lon', 'pickup_lng'),
  }
}

async function readResponseData(response) {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** 409 body: `{ detail: { error, message } }`. `message` is the line shown to the rider. */
function conflictReason(data) {
  const detail = data?.detail
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const message = String(detail.message || '').trim()
    if (message) return { code: String(detail.error || '').trim(), message }
    const code = String(detail.error || '').trim()
    if (code === 'no_active_trip') {
      return { code, message: 'This bus has no live trip right now.' }
    }
    if (code === 'trip_not_found') {
      return { code, message: 'This bus trip is not available.' }
    }
    if (code) return { code, message: code }
  }
  return { code: '', message: 'This bus is not available for tickets right now.' }
}

export async function fetchVehicleStops(vehicleId, { signal } = {}) {
  const id = String(vehicleId || '').trim()
  if (!id) throw new Error('Bus id is missing from the link')
  if (!tgsrtcBaseUrl) throw new Error('Bus ticket API is not configured')

  const response = await fetch(`${tgsrtcBaseUrl}/vehicles/${encodeURIComponent(id)}/stops`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  })
  const data = await readResponseData(response)

  if (response.status === 404) {
    const detail =
      typeof data?.detail === 'string' && data.detail.trim()
        ? data.detail.trim()
        : 'Bus not found'
    const err = new Error(detail)
    err.status = 404
    err.code = 'not_found'
    throw err
  }

  if (response.status === 409) {
    const reason = conflictReason(data)
    const err = new Error(reason.message)
    err.status = 409
    err.code = reason.code || 'conflict'
    throw err
  }

  if (!response.ok) {
    const err = new Error(`Request failed (${response.status})`)
    err.status = response.status
    throw err
  }

  return mapStopsPayload(data, id)
}

export async function fetchStopFare({ fromStopId, toStopId, chaloRouteId }, { signal } = {}) {
  if (!tgsrtcBaseUrl) throw new Error('Bus ticket API is not configured')
  try {
    const data = await GetRequest(
      `${tgsrtcBaseUrl}/fares?`,
      {
        from_stop_id: fromStopId,
        to_stop_id: toStopId,
        chalo_route_id: chaloRouteId,
      },
      { signal },
    )
    const fare = Number(data?.fare)
    if (!Number.isFinite(fare) || fare <= 0) throw new Error('Fare is unavailable for these stops')
    return {
      fare,
      fromStopId: String(data.from_stop_id || fromStopId),
      toStopId: String(data.to_stop_id || toStopId),
      chaloRouteId: String(data.chalo_route_id || chaloRouteId),
      serviceCategory: String(data.service_category || ''),
    }
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    if (!import.meta.env.DEV) throw error
    console.info('[bus-ticket] fares API unavailable, using shared sample fare', sampleFare)
    return useSampleFare()
  }
}
