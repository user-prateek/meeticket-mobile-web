function readRouteName(source) {
  return String(
    typeof source === 'string'
      ? source
      : source?.routeName || source?.routeShortName || '',
  ).trim()
}

function titleCaseToken(token) {
  const word = String(token || '').toLowerCase()
  if (!word) return ''
  return word.charAt(0).toUpperCase() + word.slice(1)
}

export function parseBusRouteName(source) {
  const raw = readRouteName(source)
  if (!raw) return { code: null, service: null }
  const parts = raw.split('-').map((part) => part.trim()).filter(Boolean)
  const code = parts[0] || null
  const service = parts.length > 1 ? parts.slice(1).map(titleCaseToken).join(' ') : null
  return { code, service }
}

/** "216-SILVER-KOTI-TO-LINGAMPALLY" → "Route: 216" */
export function busRouteLabel(source) {
  const { code } = parseBusRouteName(source)
  return code ? `Route: ${code}` : null
}

/** "365-METRO-EXPRESS" → "Boarding - Route: 365 - Metro Express" */
export function busStopRoleLabel(source, role = 'Boarding') {
  const { code, service } = parseBusRouteName(source)
  const parts = [role]
  if (code) parts.push(`Route: ${code}`)
  if (service) parts.push(service)
  return parts.join(' - ')
}
