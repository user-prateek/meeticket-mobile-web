import { getUserContext } from '../../lib/userContext'
import { orderDateTime, todayDateString } from './format'

function resolveUserId(profile) {
  const raw = profile?.userId ?? import.meta.env.VITE_ORDER_USER_ID ?? '1'
  const str = String(raw ?? '').trim()
  if (!str) return '1'
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) return str
  return /^\d+$/.test(str) ? Number(str) : str
}

export function buildBusTicketOrderPayload(draft, user = getUserContext()) {
  const profile = user || {}
  const source = draft?.source
  const dest = draft?.destination
  const seats = Math.max(1, Number(draft?.seats) || 1)
  const fare = Number(draft?.fareInr)
  if (!source || !dest) throw new Error('Choose a source and destination stop')
  if (!Number.isFinite(fare) || fare <= 0) throw new Error('Fare is unavailable')

  const date = todayDateString()
  const compactDate = date.replace(/-/g, '')
  const tripId = String(draft.tripId || source.trip_id || '')
  const amountInr = fare * seats

  return {
    user_id: resolveUserId(profile),
    name: profile.name || import.meta.env.VITE_ORDER_USER_NAME || 'Test User',
    mobile: profile.mobile || import.meta.env.VITE_ORDER_USER_MOBILE || '8755993810',
    email: profile.email || import.meta.env.VITE_ORDER_USER_EMAIL || 'test@example.com',
    pickup_lat: Number(source.stop_lat),
    pickup_lng: Number(source.stop_lon),
    pickup_place_name: source.stop_name,
    drop_lat: Number(dest.stop_lat),
    drop_lng: Number(dest.stop_lon),
    drop_place_name: dest.stop_name,
    legs: [
      {
        leg_type: 'RTC',
        fare_id: String(draft.fareRouteId || draft.chaloRouteId || ''),
        leg_info: {
          source_stop_id: draft.fareFromStopId || source.stop_id,
          destination_stop_id: draft.fareToStopId || dest.stop_id,
          route_id: draft.fareRouteId || draft.chaloRouteId,
          travel_date: date,
          FromLocName: source.stage_name || source.stop_name,
          ToLocName: dest.stage_name || dest.stop_name,
          service_category: draft.fareCategory,
          trip_id: tripId,
          trip_instance_id: tripId ? `${tripId}@${compactDate}` : undefined,
          source_stop_lat: Number(source.stop_lat),
          source_stop_lng: Number(source.stop_lon),
          destination_stop_lat: Number(dest.stop_lat),
          destination_stop_lng: Number(dest.stop_lon),
          ExpectedStartTime: orderDateTime(date, source.departure_time),
          ExpectedEndTime: orderDateTime(date, dest.arrival_time || dest.departure_time),
          adult_count: seats,
        },
        amount_paise: Math.round(amountInr * 100),
        payment_mode: 'ONLINE',
      },
    ],
  }
}
