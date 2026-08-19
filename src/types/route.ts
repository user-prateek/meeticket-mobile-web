export type TransportMode = 'metro' | 'bus' | 'walk' | 'cab' | 'auto' | 'bike'

export type TripMode = 'multi' | 'single'

export type RouteSegment = {
  id: string
  mode: TransportMode
  durationMin: number
  fareInr?: number
  title: string
  subtitle?: string
  from?: string
  to?: string
  stopCount?: number
  walkDistanceM?: number
}

export type RouteStop = {
  from: string
  to: string
  mode?: TransportMode
}

export type LastMileProvider = {
  id: string
  name: string
}

export type LastMileOption = {
  id: string
  mode: 'cab' | 'auto' | 'bike'
  label: string
}

export type JourneyService = {
  id: string
  label: string
}

export type PaymentInfo = {
  method: string
  amountInr: number
}

export type SearchQuery = {
  fromPlace: string
  toPlace: string
  mode: TripMode
}

/** One journey option. Map API responses into this shape. */
export type RouteOption = {
  id: string
  segments: RouteSegment[]
  stops: RouteStop[]
  lastMileProviders: LastMileProvider[]
  lastMileOptions: LastMileOption[]
  services: JourneyService[]
  payment: PaymentInfo
  totalDistanceKm: number
  totalTimeMin: number
  totalFareInr: number
}
