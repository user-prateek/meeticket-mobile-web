import { atom } from 'jotai'
import { atomWithStorage, createJSONStorage } from 'jotai/utils'

/** Survive refresh on /cab, /journey-detail, /success (tab-scoped). */
const storage = createJSONStorage(() => sessionStorage)
const persist = (key, initial) => atomWithStorage(key, initial, storage, { getOnInit: true })

/** Trip from `/journey` query params (coords + place names). */
export const tripAtom = persist('mt:trip:v2', null)

/**
 * User from WebView query params: user_id, mobile, name, email, mbt (metro bearer token).
 * Session-scoped — see lib/userContext.js.
 */
export const userAtom = persist('mt:user:v1', null)

/** Platform + app version from WebView query params (src, versionName, appversion). */
export const appContextAtom = persist('mt:app-context:v1', { src: '', versionName: '' })

/** Mapped journey options — in-memory only; refetch on every /journey load. */
export const journeyOptionsAtom = atom([])

/** idle | loading | ready | error */
export const journeyStatusAtom = atom('idle')

export const journeyErrorAtom = atom('')

/** Selected option id (number). */
export const selectedJourneyIdAtom = persist('mt:selected-id:v2', null)

/**
 * Full selected journey option (segments, access/egress coords).
 * Survives /success refresh when `journeyOptionsAtom` is empty.
 */
export const selectedJourneySnapshotAtom = persist('mt:selected-journey:v2', null)

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
  if (id != null) {
    const live = get(journeyOptionsAtom).find((option) => option.id === Number(id))
    if (live) return live
  }
  return get(selectedJourneySnapshotAtom)
})

export const journeyOptionByIdAtom = atom((get) => {
  const map = new Map()
  for (const option of get(journeyOptionsAtom)) {
    map.set(Number(option.id), option)
  }
  return map
})
