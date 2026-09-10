/**
 * Product search mode from Flutter WebView entry `/journey?mode=`
 * Selection UI lives in the native app — web never displays the mode.
 *
 * 1 — Metro search API only
 * 2 — TGSRTC search API only
 * 3 — Metro + TGSRTC + mix APIs (default)
 *
 * First-mile is always available (opt-in checkbox on the card). Mode does not hide it.
 * Payment / success ignore this flag.
 */
export const JOURNEY_MODE = {
  METRO: 1,
  TGSRTC: 2,
  MULTI: 3,
}

export const JOURNEY_MODE_DEFAULT = JOURNEY_MODE.MULTI

export function parseJourneyMode(value) {
  const n = Number(value)
  if (n === JOURNEY_MODE.METRO || n === JOURNEY_MODE.TGSRTC || n === JOURNEY_MODE.MULTI) {
    return n
  }
  return JOURNEY_MODE_DEFAULT
}

export function isMultiJourneyMode(mode) {
  return parseJourneyMode(mode) === JOURNEY_MODE.MULTI
}
