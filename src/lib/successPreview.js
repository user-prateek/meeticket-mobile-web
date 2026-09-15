import { buildBookingFromPgStatus } from '../constants/tickets'

export const OLA_SEARCHING_PREVIEW = 'ola-searching'

/** Dummy pg/status: Ola still finding a driver + a confirmed metro ticket for tabs. */
export function buildOlaSearchingPreviewPgStatus() {
  return {
    order_id: 'PREVIEW-OLA-SEARCHING',
    ispolling: true,
    pg_status: 'TXN_SUCCESS',
    amount: 51,
    bookings: [
      {
        leg_id: 'preview-cab-1',
        leg_type: 'CAB',
        status: 'PENDING',
        cab_aggregator: 'ola',
        payment_mode: 'CASH',
        amount_paise: 4042,
        FromLocName: 'Abids, Hyderabad',
        ToLocName: 'Nampally Metro',
        ExpectedStartTime: '2026-09-15 09:40:00',
        ExpectedEndTime: '2026-09-15 09:52:00',
        pickup_instructions: 'Meet at the pickup point for Abids, Hyderabad',
        leg_info: {
          pickup_lat: 17.385044,
          pickup_lng: 78.486671,
          drop_lat: 17.392,
          drop_lng: 78.4674,
        },
        agg_specific_info: {
          pickup_mode: 'now',
          fare_id: 'preview-fare',
          category: 'mini',
          vehicle_type: 'cab',
        },
      },
      {
        leg_id: 'preview-metro-1',
        leg_type: 'METRO',
        status: 'CONFIRMED',
        fare: 51,
        ticket_id: 'PREVIEW-METRO',
        from_station_name: 'Nampally',
        to_station_name: 'Ameerpet',
        adult_count: 1,
        child_count: 0,
        booking_confirmed_at: '2026-09-15 09:35:00',
      },
    ],
  }
}

export function buildOlaSearchingPreviewBooking({ journey, trip, lastMile } = {}) {
  const pgStatus = buildOlaSearchingPreviewPgStatus()
  return buildBookingFromPgStatus({
    journey,
    trip,
    lastMile,
    order: { orderId: pgStatus.order_id, order_id: pgStatus.order_id, pgStatus },
    pgStatus,
  })
}
