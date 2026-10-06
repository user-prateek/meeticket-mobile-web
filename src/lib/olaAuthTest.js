/** Isolated Ola callback test — do not reuse live `mt:ola-oauth:*` keys. */
const RETURN_KEY = 'mt:ola-auth-test:return'

export const OLA_AUTH_TEST_RETURN_URL =
  'https://mmtsjp.iamgds.com/journey?from_lat=17.398553&from_lon=78.436501&to_lat=17.4015441&to_lon=78.5681716&from=Mehdipatnam&to=Uppal&mode=3&access_mode=walk&egress_mode=walk&candidates=2'

export const OLA_AUTH_TEST_AUTHORIZE_URL =
  'https://devapi.olacabs.com/oauth2/authorize?response_type=token&client_id=MjY4YWEwNDUtNWY3Ni00NmI2LTk4OWYtZDRmOGNhOWYyN2Zi&redirect_uri=https://mmtsjp.iamgds.com/journey&scope=profile%20booking&state=state123'

export function saveOlaAuthTestReturn(url = OLA_AUTH_TEST_RETURN_URL) {
  if (typeof localStorage === 'undefined') return
  const value = String(url || '').trim()
  if (!value) return
  localStorage.setItem(RETURN_KEY, value)
}

export function peekOlaAuthTestReturn() {
  if (typeof localStorage === 'undefined') return ''
  return String(localStorage.getItem(RETURN_KEY) || '').trim()
}

export function clearOlaAuthTestReturn() {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(RETURN_KEY)
}

export function parseOlaAuthTestReturn(url) {
  if (typeof window === 'undefined') return null
  const raw = String(url || '').trim()
  if (!raw) return null
  try {
    const parsed = new URL(raw, window.location.origin)
    if (parsed.origin !== window.location.origin) return null
    if (!parsed.pathname.startsWith('/') || parsed.pathname.startsWith('//')) return null
    const search = parsed.search.startsWith('?') ? parsed.search.slice(1) : parsed.search
    return { pathname: parsed.pathname, search }
  } catch {
    return null
  }
}
