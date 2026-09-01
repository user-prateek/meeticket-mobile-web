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
 *   user_id, mobile, name, email
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

  if (userId) partial.userId = userId
  if (mobile) partial.mobile = mobile
  if (name) partial.name = name
  if (email) partial.email = email

  return Object.keys(partial).length ? partial : null
}

/** @returns {{ userId?: string, mobile?: string, name?: string, email?: string } | null} */
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
