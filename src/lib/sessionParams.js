/**
 * WebView / deep-link query params that belong in session state — not in the URL
 * after the first capture (src, app version, user profile, metro bearer token, etc.).
 */

const SESSION_QUERY_KEYS = new Set([
  'src',
  'versionname',
  'appversion',
  'user_id',
  'userid',
  'mobile',
  'phone',
  'phone_number',
  'name',
  'user_name',
  'username',
  'email',
  'user_email',
  'useremail',
  'mbt',
  'metro_bearer_token',
  'metrobearertoken',
  'access_token',
  'ola_access_token',
  'token_type',
  'expires_in',
])

export function isSessionQueryParam(key) {
  return SESSION_QUERY_KEYS.has(String(key || '').toLowerCase())
}

/** Returns `?foo=bar` or empty string. */
export function stripSessionParams(search = '') {
  const raw = String(search || '')
  const params = new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw)
  let changed = false

  for (const key of [...params.keys()]) {
    if (isSessionQueryParam(key)) {
      params.delete(key)
      changed = true
    }
  }

  if (!changed) return raw.startsWith('?') ? raw : raw ? `?${raw}` : ''

  const query = params.toString()
  return query ? `?${query}` : ''
}

/** Search string without leading `?` for react-router `navigate({ search })`. */
export function sessionStrippedSearch(search = '') {
  const stripped = stripSessionParams(search)
  return stripped.startsWith('?') ? stripped.slice(1) : stripped
}
