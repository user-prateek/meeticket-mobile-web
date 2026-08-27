import olaBike from '../assets/vehicles/ola_bike.png'

export const CANCEL_REASONS = [
  { id: 'wait', label: 'Wait time was too long' },
  { id: 'helmet', label: 'No helmet provided' },
  { id: 'find-driver', label: 'Could not find driver' },
  { id: 'not-closer', label: 'Driver not getting closer' },
  { id: 'asked-cancel', label: 'Driver asked me to cancel or ride off app' },
  { id: 'other', label: 'Other' },
]

/**
 * Mock active booking after confirm / book.
 * Tabs map to ticket panels for each mode in the multimodal trip.
 * Cab layout uses the "Share PIN first" variant from the design set.
 */
export function buildBooking({ journey, vehicle, serviceId, trip, refexBlock }) {
  const fare = vehicle?.fareInr ?? 55
  const vehicleLabel = vehicle?.label ?? 'OLA Bike'
  const pin = refexBlock?.verificationCode || '6151'
  const bookingRef = refexBlock?.referenceNumber || null

  const tabs = [
    { id: 'metro', label: 'Metro', mode: 'metro' },
    { id: 'bus', label: 'TGSRTC', mode: 'bus' },
    { id: 'cab', label: 'Cab', mode: 'cab' },
    { id: 'other', label: 'Other', mode: 'other' },
  ]

  const metroSeg = journey?.segments?.find((s) => s.mode === 'metro')
  const busSeg = journey?.segments?.find((s) => s.mode === 'bus')

  return {
    id: bookingRef || 'booking-demo-1',
    journeyId: journey?.id,
    serviceId: serviceId ?? 'pickup',
    defaultTab: 'cab',
    tabs,
    payment: { method: journey?.payment?.method ?? 'Cash' },
    refexBlock: refexBlock || null,
    tickets: {
      cab: {
        type: 'cab',
        title: vehicleLabel,
        fareInr: fare,
        pin,
        datetime: '11-08-26, 16:40',
        pax: 1,
        durationMin: 15,
        from: trip?.fromPlace ?? 'Ameerpet, Hyderabad',
        to: trip?.toPlace ?? 'LB Nagar, Hyderabad',
        fromRole: 'Boarding',
        toRole: 'Alighting',
        driver: {
          name: 'Ashok',
          photoInitials: 'A',
          vehicleNo: 'GJ01XP3843',
          vehicleModel: vehicle?.model ?? 'Black Suzuki Access 125',
          vehicleImage: vehicle?.icon ?? olaBike,
        },
        qrPayload: bookingRef ? `MT-REFEX-${bookingRef}` : 'MT-CAB-6151',
        tripDetails:
          'Meet at the pickup point for Off. Share the PIN with your driver to start the trip.',
        canCancel: true,
        referenceNumber: bookingRef,
      },
      metro: {
        type: 'metro',
        refId: '12345678901235564',
        fareInr: metroSeg?.fareInr ?? 55,
        datetime: '11-08-26, 16:40',
        pax: 1,
        platformNo: 2,
        tripType: 'ONEWAY',
        from: metroSeg?.from ?? 'Ameerpet Metro Station',
        to: metroSeg?.to ?? 'Chaitanyapuri Metro Station',
        validTill: "19 Aug '26, 11:59 PM",
        qrPayload: 'MT-METRO-12345678901235564',
        qrHint: 'Scan this QR at Metro Entry & Exit points',
      },
      bus: {
        type: 'bus',
        pnr: '12345678',
        fareInr: busSeg?.fareInr ?? 55,
        issuedOn: '11-08-26, 16:40',
        passengers: { adult: 1, child: 1 },
        from: busSeg?.from ?? 'Chaitanyapuri Bus Station',
        to: busSeg?.to ?? 'LB Nagar',
        validSeconds: 5 * 3600 + 58 * 60 + 43,
        qrPayload: 'MT-BUS-12345678',
        status: 'Valid',
        instruction: 'Show this QR code at the entry gate/validator to board the bus.',
        terms:
          'This ticket is non-cancellable and non-refundable. Carry a valid ID proof during travel.',
      },
      other: {
        type: 'other',
        message: 'No other tickets for this trip.',
      },
    },
  }
}
