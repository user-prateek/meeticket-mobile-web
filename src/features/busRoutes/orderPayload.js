/**
 * Exact POST /api/orders body for livebus mock until list/stops APIs feed real leg_info.
 * Signature matches journey create-order; only the RTC leg_info values are fixed dummy.
 */
export const LIVEBUS_DUMMY_ORDER_PAYLOAD = {
  user_id: '3ef80b62-90fc-47f0-bb9e-b2d6df7161fe',
  name: 'Test User',
  mobile: '8755993810',
  email: 'test@example.com',
  pickup_lat: 17.3924223,
  pickup_lng: 78.4675956,
  pickup_place_name: 'Hyderabad Deccan Nampally',
  drop_lat: 17.4036398,
  drop_lng: 78.4653197,
  drop_place_name: 'Lakdi-ka-pul',
  legs: [
    {
      leg_type: 'RTC',
      leg_info: {
        source_stop_id: '0Yr3hLAU',
        destination_stop_id: 'USn7tbeB',
        route_id: '9Q0BPQFs',
        travel_date: '2026-11-20',
        FromLocName: 'NAMPALLY RAILWAY STATION',
        ToLocName: 'LAKDIKAPOOL',
        service_category: 'CITY ORDINARY',
        trip_id: '41986458',
        trip_instance_id: '41986458@20261120',
        source_stop_lat: 17.39215949442458,
        source_stop_lng: 78.47004978666432,
        destination_stop_lat: 17.403609,
        destination_stop_lng: 78.464974,
        ExpectedStartTime: '2026-11-20 12:15:06',
        ExpectedEndTime: '2026-11-20 12:20:15',
      },
      fare_id: '9Q0BPQFs',
      amount_paise: 1500,
      payment_mode: 'ONLINE',
    },
  ],
}

/** Clone dummy payload; scale ONLINE amount by seats when summary stepper changes. */
export function buildLiveBusOrderPayload({ seats = 1 } = {}) {
  const count = Math.max(1, Number(seats) || 1)
  const base = LIVEBUS_DUMMY_ORDER_PAYLOAD
  const leg = base.legs[0]
  const unitPaise = Number(leg.amount_paise) || 0
  return {
    ...base,
    legs: [
      {
        ...leg,
        leg_info: {
          ...leg.leg_info,
          adult_count: count,
        },
        amount_paise: unitPaise * count,
      },
    ],
  }
}
