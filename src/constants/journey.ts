import type {
  JourneyService,
  LastMileOption,
  LastMileProvider,
  RouteOption,
  SearchQuery,
} from '../types/route'

export const LAST_MILE_PROVIDERS: LastMileProvider[] = [
  { id: 'ola', name: 'Ola' },
  { id: 'rapido', name: 'rapido' },
  { id: 'refex', name: 'refex' },
]

export const LAST_MILE_OPTIONS: LastMileOption[] = [
  { id: 'cab', mode: 'cab', label: 'Cab' },
  { id: 'auto', mode: 'auto', label: 'Auto' },
  { id: 'bike', mode: 'bike', label: 'Bike' },
]

export const JOURNEY_SERVICES: JourneyService[] = [
  { id: 'pickup', label: 'Pickup Service' },
  { id: 'drop', label: 'Drop Service' },
]

export const SEARCH_DEFAULTS: SearchQuery = {
  fromPlace: 'Ameerpet, Hyderabad',
  toPlace: 'LB Nagar, Hyderabad',
  mode: 'multi',
}

/**
 * Mock journey list. Replace `getRouteList` / `getRouteById` with API calls later.
 */
export const ROUTE_LIST: RouteOption[] = [
  {
    id: 'route-metro-bus',
    segments: [
      {
        id: 'seg-metro-1',
        mode: 'metro',
        durationMin: 18,
        fareInr: 85,
        title: 'Metro',
        from: 'Ameerpet Metro Station',
        to: 'Chaitanyapuri Metro Station',
        stopCount: 1,
      },
      {
        id: 'seg-walk-1',
        mode: 'walk',
        durationMin: 5,
        title: 'Walk 400 m',
        subtitle: 'Walk 400 m',
        from: 'Chaitanyapuri Metro Station',
        to: 'Chaitanyapuri Bus Station',
        walkDistanceM: 400,
      },
      {
        id: 'seg-bus-1',
        mode: 'bus',
        durationMin: 15,
        fareInr: 55,
        title: 'Bus TGSRTC',
        from: 'Chaitanyapuri Bus Station',
        to: 'LB Nagar',
        stopCount: 1,
      },
    ],
    stops: [
      {
        from: 'Ameerpet Metro Station',
        to: 'Chaitanyapuri Metro Station',
        mode: 'metro',
      },
      {
        from: 'Chaitanyapuri Bus Station',
        to: 'LB Nagar',
        mode: 'bus',
      },
    ],
    lastMileProviders: LAST_MILE_PROVIDERS,
    lastMileOptions: LAST_MILE_OPTIONS,
    services: JOURNEY_SERVICES,
    payment: { method: 'Cash', amountInr: 140 },
    totalDistanceKm: 14.2,
    totalTimeMin: 55,
    totalFareInr: 140,
  },
  {
    id: 'route-bus-metro',
    segments: [
      {
        id: 'seg-bus-2',
        mode: 'bus',
        durationMin: 15,
        fareInr: 55,
        title: 'Bus TGSRTC',
        from: 'Chaitanyapuri Bus Station',
        to: 'Ameerpet Bus Stop',
        stopCount: 1,
      },
      {
        id: 'seg-walk-2',
        mode: 'walk',
        durationMin: 5,
        title: 'Walk 400 m',
        subtitle: 'Walk 400 m',
        from: 'Ameerpet Bus Stop',
        to: 'Ameerpet Metro Station',
        walkDistanceM: 400,
      },
      {
        id: 'seg-metro-2',
        mode: 'metro',
        durationMin: 18,
        fareInr: 85,
        title: 'Metro',
        from: 'Ameerpet Metro Station',
        to: 'Raidurg Metro Station',
        stopCount: 1,
      },
    ],
    stops: [
      {
        from: 'Chaitanyapuri Bus Station',
        to: 'Ameerpet Bus Stop',
        mode: 'bus',
      },
      {
        from: 'Ameerpet Metro Station',
        to: 'Raidurg Metro Station',
        mode: 'metro',
      },
    ],
    lastMileProviders: LAST_MILE_PROVIDERS,
    lastMileOptions: LAST_MILE_OPTIONS,
    services: JOURNEY_SERVICES,
    payment: { method: 'Cash', amountInr: 140 },
    totalDistanceKm: 12.8,
    totalTimeMin: 70,
    totalFareInr: 140,
  },
  {
    id: 'route-metro-only',
    segments: [
      {
        id: 'seg-metro-3',
        mode: 'metro',
        durationMin: 18,
        fareInr: 85,
        title: 'Metro',
        from: 'Ameerpet Metro Station',
        to: 'Hitec City Metro Station',
        stopCount: 6,
      },
    ],
    stops: [
      {
        from: 'Ameerpet Metro Station',
        to: 'Hitec City Metro Station',
        mode: 'metro',
      },
    ],
    lastMileProviders: LAST_MILE_PROVIDERS,
    lastMileOptions: LAST_MILE_OPTIONS,
    services: JOURNEY_SERVICES,
    payment: { method: 'Cash', amountInr: 85 },
    totalDistanceKm: 7.5,
    totalTimeMin: 18,
    totalFareInr: 85,
  },
]

export function getRouteList(): RouteOption[] {
  return ROUTE_LIST
}

export function getRouteById(id: string): RouteOption | undefined {
  return ROUTE_LIST.find((route) => route.id === id)
}
