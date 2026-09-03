/**
 * Early journey prefetch (started from index.html before React loads).
 * Lets metro + TGSRTC requests run in parallel with the JS download on slow networks.
 */

const PREFETCH_KEY = '__MT_JOURNEY_PREFETCH__'

export function getJourneyPrefetchStore() {
  if (typeof window === 'undefined') return null
  return window[PREFETCH_KEY] || null
}

/** One-shot consume — returns source → Promise<json> map when trip key matches. */
export function takeJourneySourcePrefetches(tripKey) {
  const store = getJourneyPrefetchStore()
  if (!store || !store.key || store.key !== tripKey || !store.sources) return null
  const sources = store.sources
  // Prevent double-consume / stale reuse after navigation.
  store.sources = null
  store.consumed = true
  return sources
}

export function journeyPrefetchKeyFromParts({
  fromLat,
  fromLon,
  toLat,
  toLon,
  accessMode = 'walk',
  egressMode = 'walk',
  candidates = 2,
}) {
  return [fromLat, fromLon, toLat, toLon, accessMode, egressMode, candidates].join('|')
}
