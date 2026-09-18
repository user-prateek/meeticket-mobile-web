const USER_KEY = 'mt:user:v1'

function firstParam(params, keys) {
  for (const key of keys) {
    const value = params.get(key)
    if (value != null && value !== '') return value
  }
  return null
}

/**
 * User fields from WebView / deep-link query params:
 *   user_id, mobile, name, email, mbt (metro bearer token)
 */
export function parseUserQuery(source) {
  const params =
    source instanceof URLSearchParams
      ? source
      : new URLSearchParams(
          String(source || '').startsWith('?') ? String(source).slice(1) : String(source || ''),
        )

  const partial = {}
  const userId = firstParam(params, ['user_id', 'userId'])
  const mobile = firstParam(params, ['mobile', 'phone', 'phone_number'])
  const name = firstParam(params, ['name', 'user_name', 'userName'])
  const email = firstParam(params, ['email', 'user_email', 'userEmail'])
  const metroBearerToken = firstParam(params, ['mbt', 'metro_bearer_token', 'metroBearerToken'])
  const olaAccessToken = firstParam(params, ['ola_access_token', 'access_token'])

  if (userId) partial.userId = userId
  if (mobile) partial.mobile = mobile
  if (name) partial.name = name
  if (email) partial.email = email
  if (metroBearerToken) partial.metroBearerToken = metroBearerToken
  if (olaAccessToken) partial.olaAccessToken = olaAccessToken

  return Object.keys(partial).length ? partial : null
}

/** @returns {{ userId?: string, mobile?: string, name?: string, email?: string, metroBearerToken?: string } | null} */
export function loadUserContext() {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/** Merge URL user fields into sessionStorage (keeps existing values when omitted). */
export function captureUserFromSearch(search = '') {
  if (typeof sessionStorage === 'undefined') return null
  const parsed = parseUserQuery(search)
  if (!parsed) return loadUserContext()

  const prev = loadUserContext() || {}
  const next = { ...prev, ...parsed }
  sessionStorage.setItem(USER_KEY, JSON.stringify(next))
  return next
}

export function getUserContext() {
  return loadUserContext()
}

/** Merge fields into the session user profile (same storage as userAtom). */
export function persistUserPatch(patch = {}) {
  if (typeof sessionStorage === 'undefined') return loadUserContext()
  const prev = loadUserContext() || {}
  const next = { ...prev }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    next[key] = value
  }
  sessionStorage.setItem(USER_KEY, JSON.stringify(next))
  return next
}
