import { atom } from 'jotai'

/** Trip from `/journey` query params (coords + place names). */
export const tripAtom = atom(null)

/** Last trip key used to fetch options. */
export const journeyTripKeyAtom = atom('')

/** Mapped journey options list (ids: 1, 2, 3, …). */
export const journeyOptionsAtom = atom([])

/** idle | loading | ready | error */
export const journeyStatusAtom = atom('idle')

export const journeyErrorAtom = atom('')

/** Selected option id (number). */
export const selectedJourneyIdAtom = atom(null)

/** Raw API payload for last successful fetch. */
export const journeyRawAtom = atom([])

/** Booking after cab confirm (success page). */
export const bookingAtom = atom(null)

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
