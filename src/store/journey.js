import { atom } from 'jotai'
import { atomWithStorage, createJSONStorage } from 'jotai/utils'

/** Survive refresh on /cab, /journey-detail, /success (tab-scoped). */
const storage = createJSONStorage(() => sessionStorage)
const persist = (key, initial) => atomWithStorage(key, initial, storage, { getOnInit: true })

/** Trip from `/journey` query params (coords + place names). */
export const tripAtom = persist('mt:trip:v2', null)

/**
 * User from WebView query params: user_id, mobile, name, email.
 * Session-scoped — see lib/userContext.js.
 */
export const userAtom = persist('mt:user:v1', null)

/** Mapped journey options — in-memory only; refetch on every /journey load. */
export const journeyOptionsAtom = atom([])

/** idle | loading | ready | error */
export const journeyStatusAtom = atom('idle')

export const journeyErrorAtom = atom('')

/** Selected option id (number). */
export const selectedJourneyIdAtom = persist('mt:selected-id:v2', null)

/** Raw API payload for the current in-memory fetch. */
export const journeyRawAtom = atom([])

/** POST /api/orders response + session fields (`orderId`, `journeyId`, `createdAt`). */
export const orderAtom = persist('mt:order:v1', null)

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
