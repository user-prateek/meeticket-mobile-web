import { buildOlaAuthorizeUrl, createOlaOauthState, rememberOlaOauthState, saveOlaOauthReturn } from './olaOauth'

/** Test return page. OAuth state and `mt:ola-oauth:return` are the same keys as the live flow. */
const RETURN_KEY = 'mt:ola-auth-test:return'
const MOBILE_KEY = 'mt:ola-auth-test:mobile'

export const OLA_AUTH_TEST_RETURN_URL =
  'https://mmtsjp.iamgds.com/journey?from_lat=17.398553&from_lon=78.436501&to_lat=17.4015441&to_lon=78.5681716&from=Mehdipatnam&to=Uppal&mode=3&access_mode=walk&egress_mode=walk&candidates=2'

export function saveOlaAuthTestReturn(url = OLA_AUTH_TEST_RETURN_URL, mobile) {
  if (typeof localStorage === 'undefined') return
  const value = String(url || '').trim()
  if (!value) return
  localStorage.setItem(RETURN_KEY, value)
  const phone = String(mobile || '').trim()
  if (phone) localStorage.setItem(MOBILE_KEY, phone)
}

export function peekOlaAuthTestReturn() {
  if (typeof localStorage === 'undefined') return ''
  return String(localStorage.getItem(RETURN_KEY) || '').trim()
}

export function peekOlaAuthTestMobile() {
  if (typeof localStorage === 'undefined') return ''
  return String(localStorage.getItem(MOBILE_KEY) || '').trim()
}

export function clearOlaAuthTestReturn() {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(RETURN_KEY)
  localStorage.removeItem(MOBILE_KEY)
}

/** Same authorize URL as the live flow: encoded redirect_uri, fresh state. */
export function startOlaAuthTest(mobile) {
  saveOlaAuthTestReturn(OLA_AUTH_TEST_RETURN_URL, mobile)
  const state = createOlaOauthState()
  rememberOlaOauthState(state)
  try {
    const parsed = new URL(OLA_AUTH_TEST_RETURN_URL)
    saveOlaOauthReturn({
      url: `${parsed.pathname}${parsed.search}`,
      mobile,
      showCab: true,
    })
  } catch {
    /* return URL is restored only when it parses */
  }
  const url = buildOlaAuthorizeUrl({ state })
  if (!url || typeof window === 'undefined') return false
  window.location.assign(url)
  return true
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
