/**
 * Indian metro line colors (Delhi, Hyderabad, Bengaluru, Mumbai, Chennai, …).
 * Matched from API `route_id` / short name when it contains a color token.
 */
export const METRO_LINE_HEX = {
  red: '#e31e24',
  yellow: '#f5c518',
  blue: '#0066b3',
  green: '#00a651',
  violet: '#6b2d8b',
  pink: '#e91e8c',
  magenta: '#c2185b',
  grey: '#7a7a7a',
  orange: '#ff6011',
  purple: '#7b2d8e',
  aqua: '#00bcd4',
  cyan: '#00bcd4',
  brown: '#8b4513',
  silver: '#a0a4a8',
  gold: '#d4a017',
  lime: '#c0d433',
  turquoise: '#40e0d0',
}

/** Longer tokens first so "magenta" wins over "red", etc. */
const LINE_TOKEN_RE =
  /magenta|turquoise|violet|yellow|orange|purple|silver|green|brown|blue|pink|grey|gray|aqua|cyan|gold|lime|red/i

export function metroLineFromRouteId(routeId) {
  if (!routeId) return null
  const match = String(routeId).match(LINE_TOKEN_RE)
  if (!match) return null
  let id = match[0].toLowerCase()
  if (id === 'gray') id = 'grey'
  const hex = METRO_LINE_HEX[id]
  return hex ? { id, hex } : null
}
