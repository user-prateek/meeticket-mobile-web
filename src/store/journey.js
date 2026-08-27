import { atom } from 'jotai'
import { atomWithStorage, createJSONStorage } from 'jotai/utils'

/** Survive refresh on /cab, /journey-detail, /success (tab-scoped). */
const storage = createJSONStorage(() => sessionStorage)
const persist = (key, initial) => atomWithStorage(key, initial, storage, { getOnInit: true })

/** Trip from `/journey` query params (coords + place names). */
export const tripAtom = persist('mt:trip:v2', null)

/** Last trip key used to fetch options. */
export const journeyTripKeyAtom = persist('mt:trip-key:v2', '')

/** Mapped journey options list (ids: 1, 2, 3, …). */
export const journeyOptionsAtom = persist('mt:options:v2', [])

/** idle | loading | ready | error */
export const journeyStatusAtom = persist('mt:status:v2', 'idle')

export const journeyErrorAtom = persist('mt:error:v2', '')

/** Selected option id (number). */
export const selectedJourneyIdAtom = persist('mt:selected-id:v2', null)

/** Raw API payload for last successful fetch. */
export const journeyRawAtom = persist('mt:raw:v2', [])

/** Booking after cab confirm (success page). */
export const bookingAtom = persist('mt:booking:v2', null)

/**
 * Last-mile choice from SRP card (provider + vehicle type).
 * null / missing vehicleId means none selected.
 */
export const lastMileSelectionAtom = persist('mt:last-mile:v2', null)

export const selectedJourneyAtom = atom((get) => {
  const id = get(selectedJourneyIdAtom)
  if (id == null) return null
  return get(journeyOptionsAtom).find((option) => option.id === Number(id)) ?? null
})

export const journeyOptionByIdAtom = atom((get) => {
  const map = new Map()
  for (const option of get(journeyOptionsAtom)) {
    map.set(Number(option.id), option)
  }
  return map
})
