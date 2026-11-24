/**
 * Stand-in for nearby-buses / route-detail until production APIs are live.
 * Shape matches list cards + map pins + journey detail.
 */

import { routeHeading } from './mapBusRoutes'

const ROUTE_ID = '505'

/** Road-side coords in boarding order along LB Nagar → Ameerpet. */
const STOPS = [
  { id: 'lbnagar-x', name: 'L.B. Nagar X Roads', time: '11:20 AM', role: 'passed', lat: 17.3496, lng: 78.5492 },
  { id: 'dilsukhnagar', name: 'Dilsukhnagar Bus Station', time: '11:28 AM', role: 'pickup', lat: 17.3686, lng: 78.5247 },
  { id: 'chaitanyapuri', name: 'Chaitanyapuri', time: '11:32 AM', lat: 17.3689, lng: 78.5182 },
  { id: 'malakpet', name: 'Malakpet', time: '11:44 AM', lat: 17.3739, lng: 78.4936 },
  { id: 'victoria', name: 'Victoria Memorial Metro Station', time: '11:48 AM', lat: 17.3821, lng: 78.4864 },
  { id: 'narayanguda', name: 'Narayanguda', time: '11:56 AM', lat: 17.3991, lng: 78.4902 },
  { id: 'chikkadpally', name: 'Chikkadpally', time: '12:01 PM', lat: 17.4056, lng: 78.4928 },
  { id: 'rtc', name: 'RTC X Roads', time: '12:06 PM', lat: 17.4124, lng: 78.4971 },
  { id: 'punjagutta', name: 'Punjagutta', time: '12:11 PM', lat: 17.4268, lng: 78.4522 },
  { id: 'maitrivanam', name: 'Maitrivanam Bus Stop', time: '12:16 PM', role: 'drop', lat: 17.4372, lng: 78.4486 },
]

const BUS_POS = { lat: 17.358, lng: 78.538 }

const DETAIL = {
  routeId: ROUTE_ID,
  code: '505',
  category: 'Deluxe',
  fareInr: 10,
  fromPlace: 'LB Nagar',
  toPlace: 'Ameerpet',
  vehicleNo: 'J1010',
  busType: 'Deluxe',
  boardingName: 'Dilsukhnagar Bus Stations',
  busLabel: '5 min away',
  bus: {
    ...BUS_POS,
    heading: routeHeading(BUS_POS.lat, BUS_POS.lng, STOPS[1].lat, STOPS[1].lng),
  },
  originPin: { lat: STOPS[1].lat, lng: STOPS[1].lng },
  destinationPin: { lat: STOPS[STOPS.length - 1].lat, lng: STOPS[STOPS.length - 1].lng },
  departures: [
    { id: '1231', time: '12:31 PM' },
    { id: '1245', time: '12:45 PM' },
    { id: '1310', time: '01:10 PM' },
    { id: '1325', time: '01:25 PM' },
  ],
  stops: STOPS,
}

const CARDS = [
  {
    id: '505',
    code: '505',
    from: 'LB Nagar Dilsukhnagar Bus Station',
    to: 'Ameerpet Bus Stop',
    corridor: 'NGOS Colony → Patancheru',
    departLabel: '7 Min',
    scheduled: true,
    routeId: ROUTE_ID,
    tripId: '505-1231',
    originStopId: 'dilsukhnagar',
    destinationStopId: 'maitrivanam',
    lat: 17.358,
    lng: 78.538,
    destLat: 17.4372,
    destLng: 78.4486,
    heading: routeHeading(17.358, 78.538, 17.3686, 78.5247),
    color: '#e11d2e',
    fareInr: 35,
    category: 'Deluxe',
    choices: [{ fareInr: 35, category: 'Deluxe', classId: 'deluxe' }],
  },
  {
    id: '47b',
    code: '47B',
    from: 'LB Nagar Ring Road',
    to: 'Ameerpet Metro',
    corridor: 'Hayathnagar → Sanathnagar',
    departLabel: '12:31 PM',
    scheduled: true,
    routeId: ROUTE_ID,
    tripId: '47b-1',
    originStopId: 'lbnagar-x',
    destinationStopId: 'maitrivanam',
    lat: 17.365,
    lng: 78.52,
    destLat: 17.4372,
    destLng: 78.4486,
    heading: routeHeading(17.365, 78.52, 17.3739, 78.4936),
    color: '#2563eb',
    fareInr: 25,
    category: 'Ordinary',
    choices: [{ fareInr: 25, category: 'Ordinary', classId: 'ordinary' }],
  },
  {
    id: '218',
    code: '218',
    from: 'Dilsukhnagar',
    to: 'Punjagutta',
    corridor: 'Uppal → Mehdipatnam',
    departLabel: '12 Min',
    scheduled: true,
    routeId: ROUTE_ID,
    tripId: '218-1',
    originStopId: 'dilsukhnagar',
    destinationStopId: 'punjagutta',
    lat: 17.38,
    lng: 78.5,
    destLat: 17.4268,
    destLng: 78.4522,
    heading: routeHeading(17.38, 78.5, 17.3991, 78.4902),
    color: '#dc2626',
    fareInr: 30,
    category: 'Ordinary',
    choices: [{ fareInr: 30, category: 'Ordinary', classId: 'ordinary' }],
  },
  {
    id: '19m',
    code: '19M',
    from: 'Nagole',
    to: 'RTC X Roads',
    corridor: 'LB Nagar → Secunderabad',
    departLabel: '18 Min',
    scheduled: true,
    routeId: ROUTE_ID,
    tripId: '19m-1',
    originStopId: 'nagole',
    destinationStopId: 'rtc',
    lat: 17.4,
    lng: 78.49,
    destLat: 17.4124,
    destLng: 78.4971,
    heading: routeHeading(17.4, 78.49, 17.4124, 78.4971),
    color: '#eab308',
    fareInr: 25,
    category: 'AC',
    choices: [{ fareInr: 25, category: 'AC', classId: 'ac' }],
  },
  {
    id: '5c',
    code: '5C',
    from: 'Malakpet',
    to: 'Ameerpet',
    corridor: 'Charminar → Kukatpally',
    departLabel: '9 Min',
    scheduled: true,
    routeId: ROUTE_ID,
    tripId: '5c-1',
    originStopId: 'malakpet',
    destinationStopId: 'maitrivanam',
    lat: 17.39,
    lng: 78.48,
    destLat: 17.4372,
    destLng: 78.4486,
    heading: routeHeading(17.39, 78.48, 17.4268, 78.4522),
    color: '#7c3aed',
    fareInr: 20,
    category: 'Deluxe',
    choices: [{ fareInr: 20, category: 'Deluxe', classId: 'deluxe' }],
  },
]

const CHECKOUT = {
  routeId: ROUTE_ID,
  code: '505',
  category: 'Deluxe',
  fareInr: 10,
  fromPlace: 'LB Nagar',
  toPlace: 'Ameerpet',
  boardingStop: 'Dilsukhnagar Bus Station',
  alightingStop: 'Maitrivanam Bus Stop',
  legs: [
    { id: 'source', kind: 'source', label: 'Current Source Location', name: 'LB Nagar' },
    { id: 'board', kind: 'board', label: 'Boarding Stop', name: 'Dilsukhnagar Bus Station', distance: '3.5 km' },
    { id: 'alight', kind: 'alight', label: 'Alighting Stop', name: 'Maitrivanam Bus Stop', distance: '16 km' },
    { id: 'dest', kind: 'dest', label: 'Destination Location', name: 'Ameerpet Metro Station', distance: '900 m' },
  ],
  ticket: {
    date: '11-08-2026',
    passengerId: '123456',
    validForSec: 5 * 3600 + 58 * 60 + 43,
    qr: 'MEETICKET-505-123456',
  },
}

function ready(signal, value) {
  if (signal?.aborted) {
    const error = new Error('Aborted')
    error.name = 'AbortError'
    return Promise.reject(error)
  }
  return Promise.resolve(value)
}

export function fetchMockBusRoutes(_trip, { signal } = {}) {
  return ready(signal, CARDS)
}

export function fetchMockLiveBuses({ signal } = {}) {
  return ready(
    signal,
    CARDS.map((card) => ({
      id: card.id,
      code: card.code,
      routeId: card.routeId,
      lat: card.lat,
      lng: card.lng,
      color: card.color,
      heading: card.heading,
      originStopId: card.originStopId,
      destinationStopId: card.destinationStopId,
      fareInr: card.fareInr,
      category: card.category,
    })),
  )
}

export function fetchMockRouteDetail(_routeId, { signal } = {}) {
  return ready(signal, DETAIL)
}

export function fetchMockCheckout(_routeId, { signal } = {}) {
  return ready(signal, CHECKOUT)
}
